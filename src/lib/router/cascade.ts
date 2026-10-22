import { ChoiceAnswer, ScoreAnswer, TruthAnswer, type Answer, type Decision } from "@decisionnode/sdk";
import { URGENCY_LEVELS } from "../forms/definitions";
import type { FormDef, Submission } from "../forms/types";
import { MODEL_IDS, type ModelKey, type RouterConfig } from "./config";
import { confidenceOf, isSure } from "./confidence";
import { describeError } from "./errors";
import { QUESTION_IDS, buildQuestions, buildState, type QuestionId, type RouterQuestions } from "./questions";
import type {
  AnswerView,
  Attempt,
  CallRecord,
  FinalAnswer,
  QuestionResult,
  RouteOutcome,
  SafeAction,
} from "./types";

/** The part of the SDK client the router uses, so tests can pass a fake. */
export interface Decider {
  decide(params: {
    model: string;
    state: unknown;
    questions: Partial<RouterQuestions>;
    fallback?: boolean;
  }): Promise<Decision>;
}

export type Deciders = Record<ModelKey, Decider>;

export interface RouteInput {
  form: FormDef;
  submission: Submission;
  config: Pick<RouterConfig, "models" | "threshold">;
  clients: Deciders;
  /** Milliseconds, for measuring each call. Default: `performance.now`. */
  now?: () => number;
}

interface Settled {
  model: ModelKey;
  answer: AnswerView;
}

/**
 * Routes one submission through the cascade. Every question goes to the first
 * model; each one it is unsure of goes on to the next, alone with the other
 * unsure ones. An answer at or above the threshold is final. A question no
 * model was sure of takes the form's safe action.
 */
export async function route({ form, submission, config, clients, now = () => performance.now() }: RouteInput): Promise<RouteOutcome> {
  const state = buildState(form, submission);
  const questions = buildQuestions(form);
  const attempts: Record<QuestionId, Attempt[]> = { destination: [], urgency: [], spam: [] };
  const settled: Partial<Record<QuestionId, Settled>> = {};
  const calls: CallRecord[] = [];
  let pending: QuestionId[] = [...QUESTION_IDS];

  for (const [i, model] of config.models.entries()) {
    if (pending.length === 0) break;
    const last = i === config.models.length - 1;
    const asked = Object.fromEntries(pending.map((id) => [id, questions[id]])) as Partial<RouterQuestions>;
    const start = now();

    let decision: Decision;
    try {
      decision = await clients[model].decide({
        model: MODEL_IDS[model],
        state,
        questions: asked,
        // the re-check must come from the full model, never from Flash in its place
        ...(model === "moe" ? { fallback: false } : {}),
      });
    } catch (err) {
      const error = describeError(model, err);
      calls.push(failedCall(model, pending, now() - start, err, error));
      // Flash failing hands its questions to the next model; the last model failing fails the routing
      if (!last && model === "flash") continue;
      return { ok: false, error: { message: error.message, retryable: error.retryable, calls } };
    }

    const call = calls.length;
    calls.push(answeredCall(model, pending, now() - start, decision));

    const stillUnsure: QuestionId[] = [];
    for (const id of pending) {
      const raw = decision.answers[id] as Answer | undefined;
      const answer = view(form, id, raw);
      const confidence = answer.kind === "destination_unregistered" || answer.kind === "none" ? 0 : confidenceOf(raw);
      const sure = isSure(confidence, config.threshold);
      attempts[id].push({ model, call, answer, confidence, sure });
      if (sure) settled[id] = { model, answer };
      else stillUnsure.push(id);
    }
    pending = stillUnsure;
  }

  const results = {} as Record<QuestionId, QuestionResult>;
  for (const id of QUESTION_IDS) {
    const done = settled[id];
    if (done) {
      results[id] = { id, attempts: attempts[id], final: finalOf(done.answer), settledBy: done.model, safeAction: null };
    } else {
      const safe = safeActionFor(form, id);
      results[id] = { id, attempts: attempts[id], final: safeFinal(safe), settledBy: "safe", safeAction: safe };
    }
  }

  const destination = results.destination.final as Extract<FinalAnswer, { kind: "destination" }>;
  const spam = results.spam.final as Extract<FinalAnswer, { kind: "spam" }>;

  return {
    ok: true,
    result: {
      formId: form.id,
      threshold: config.threshold,
      models: [...config.models],
      questions: results,
      calls,
      settledByFlash: QUESTION_IDS.filter((id) => results[id].settledBy === "flash").length,
      safeActionTaken: QUESTION_IDS.some((id) => results[id].settledBy === "safe"),
      destination: { teamId: destination.teamId, teamName: destination.teamName },
      deliver: !spam.spam,
    },
  };
}

/** What the result does with a question no model was sure of. */
export function safeActionFor(form: FormDef, id: QuestionId): SafeAction {
  if (id === "destination") {
    const team = form.teams.find((t) => t.id === form.triageTeam)!;
    return { question: "destination", teamId: team.id, teamName: team.name };
  }
  return { question: id };
}

function safeFinal(safe: SafeAction): FinalAnswer {
  if (safe.question === "destination") return { kind: "destination", teamId: safe.teamId, teamName: safe.teamName };
  if (safe.question === "urgency") return { kind: "urgency", label: "Unsure", level: null };
  // never silently dropped: an unsure spam check is delivered and marked for review
  return { kind: "spam", spam: false, review: true };
}

function finalOf(answer: AnswerView): FinalAnswer {
  switch (answer.kind) {
    case "destination":
      return { kind: "destination", teamId: answer.teamId, teamName: answer.teamName };
    case "urgency":
      return { kind: "urgency", label: answer.label, level: answer.level };
    case "spam":
      return { kind: "spam", spam: answer.spam, review: false };
    default:
      throw new Error(`an answer of kind ${answer.kind} cannot be final`);
  }
}

function view(form: FormDef, id: QuestionId, raw: Answer | undefined): AnswerView {
  if (id === "destination" && raw instanceof ChoiceAnswer) {
    const team = form.teams.find((t) => t.id === raw.choice);
    return team
      ? { kind: "destination", teamId: team.id, teamName: team.name }
      : { kind: "destination_unregistered", value: String(raw.choice) };
  }
  if (id === "urgency" && raw instanceof ScoreAnswer && Number.isFinite(raw.score)) {
    const level = Math.min(URGENCY_LEVELS.length - 1, Math.max(0, Math.round(raw.score)));
    return { kind: "urgency", level, label: URGENCY_LEVELS[level].label, score: raw.score };
  }
  if (id === "spam" && raw instanceof TruthAnswer && Number.isFinite(raw.truth)) {
    return { kind: "spam", probability: raw.truth, spam: raw.truth >= 0.5 };
  }
  return { kind: "none" };
}

function answeredCall(model: ModelKey, questions: QuestionId[], elapsedMs: number, d: Decision): CallRecord {
  return {
    model,
    version: d.model ?? null,
    questions: [...questions],
    elapsedMs: Math.round(elapsedMs),
    serverMs: d.latencyMs,
    usage: {
      inputTokens: d.usage.inputTokens,
      outputTokens: d.usage.outputTokens,
      costUsd: d.usage.cost?.usd ?? null,
      freeTier: d.usage.cost?.freeTier ?? null,
    },
    requestId: d.requestId,
    error: null,
  };
}

function failedCall(
  model: ModelKey,
  questions: QuestionId[],
  elapsedMs: number,
  err: unknown,
  error: CallRecord["error"],
): CallRecord {
  const requestId = err && typeof err === "object" && "requestId" in err ? (err.requestId as string | null) : null;
  return {
    model,
    version: null,
    questions: [...questions],
    elapsedMs: Math.round(elapsedMs),
    serverMs: null,
    usage: null,
    requestId,
    error,
  };
}
