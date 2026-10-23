import { ChoiceAnswer, Image, ScoreAnswer, TruthAnswer, type Answer, type Booster, type Decision, type Question } from "@decisionnode/sdk";
import { URGENCY_LEVELS } from "../forms/common";
import type { FormDef, Submission } from "../forms/types";
import { MODEL_SHORT } from "../format";
import { MODEL_IDS, type ModelKey, type RouterConfig } from "./config";
import { confidenceOf, isSure } from "./confidence";
import { describeError } from "./errors";
import { knowledgeBooster, readKnowledge } from "./knowledge";
import { buildQuestions, buildState, questionsFor, type AskedQuestion } from "./questions";
import type { AnswerView, Attempt, CallRecord, FinalAnswer, Outcome, QuestionResult, RouteOutcome } from "./types";

/** What the router sends in one call. */
export interface DecideParams {
  model: string;
  state: unknown;
  questions: Record<string, Question>;
  images?: Image[];
  boosters?: Booster[];
  fallback?: boolean;
}

/** The part of the SDK client the router uses, so tests can pass a fake. */
export interface Decider {
  decide(params: DecideParams): Promise<Decision>;
}

export type Deciders = Record<ModelKey, Decider>;

export interface RouteInput {
  form: FormDef;
  submission: Submission;
  config: Pick<RouterConfig, "models" | "threshold" | "knowledgeBase">;
  clients: Deciders;
  /** Milliseconds, for measuring each call. Default: `performance.now`. */
  now?: () => number;
}

/**
 * Routes one submission through the cascade. Every question goes to the first
 * model; each one it is unsure of goes on to the next, alone with the other
 * unsure ones. An answer at or above the threshold is final. A question no
 * model was sure of takes the form's safe action. With a knowledge base, every
 * call reads the form's routing rules, and fails rather than route without them.
 */
export async function route({ form, submission, config, clients, now = () => performance.now() }: RouteInput): Promise<RouteOutcome> {
  const asked = questionsFor(form, submission.pictures.length > 0);
  const byId = new Map(asked.map((q) => [q.id, q]));
  const state = buildState(form, submission);
  const questions = buildQuestions(form, asked);
  const images = submission.pictures.map((p) => Image.fromBase64(p.id, p.base64, p.mediaType));
  const boosters = config.knowledgeBase ? [knowledgeBooster(config.knowledgeBase, form.id)] : undefined;

  const attempts = new Map<string, Attempt[]>(asked.map((q) => [q.id, []]));
  const settled = new Map<string, { model: ModelKey; answer: AnswerView }>();
  const calls: CallRecord[] = [];
  let pending = asked.map((q) => q.id);
  // set when the last model could not answer, such as "DecisionNode was busy (no ready worker)"
  let unavailable: string | null = null;

  for (const [i, model] of config.models.entries()) {
    if (pending.length === 0) break;
    const last = i === config.models.length - 1;
    const start = now();

    let decision: Decision;
    try {
      decision = await clients[model].decide({
        model: MODEL_IDS[model],
        state,
        questions: Object.fromEntries(pending.map((id) => [id, questions[id]])),
        ...(images.length > 0 ? { images } : {}),
        ...(boosters ? { boosters } : {}),
        // the re-check must come from the full model, never from Flash in its place
        ...(model === "moe" ? { fallback: false } : {}),
      });
    } catch (err) {
      const error = describeError(model, err);
      calls.push(failedCall(model, pending, submission.pictures.length, now() - start, err, error));
      // Flash failing hands its questions to the next model, unless every model would fail alike
      if (!last && model === "flash" && error.passOn) continue;
      // the last model busy, too slow or unreachable: route on what the models before it answered
      if (last && error.unavailable) {
        unavailable = error.unavailable;
        break;
      }
      return { ok: false, error: { message: error.message, retryable: error.retryable, calls } };
    }

    const call = calls.length;
    calls.push(answeredCall(model, pending, submission.pictures.length, now() - start, decision, boosters !== undefined));

    const stillUnsure: string[] = [];
    for (const id of pending) {
      const raw = decision.answers[id] as Answer | undefined;
      const answer = view(form, byId.get(id)!, raw);
      const confidence = answer.kind === "destination_unregistered" || answer.kind === "none" ? 0 : confidenceOf(raw);
      const sure = isSure(confidence, config.threshold);
      attempts.get(id)!.push({ model, call, answer, confidence, sure });
      if (sure) settled.set(id, { model, answer });
      else stillUnsure.push(id);
    }
    pending = stillUnsure;
  }

  const results: QuestionResult[] = asked.map((q) => {
    const done = settled.get(q.id);
    const base = { id: q.id, kind: q.kind, title: q.title, attempts: attempts.get(q.id)! };
    if (done) {
      const final = finalOf(done.answer, q);
      return { ...base, final, settledBy: done.model, safeAction: null, note: noteOf(final, q), unanswered: null, kept: false };
    }
    // the last model could not answer: an earlier model's answer stands, below the threshold as it is;
    // asking that model again would give the same answer and bill it twice
    const earlier = unavailable ? base.attempts.findLast((a) => usable(a.answer)) : undefined;
    if (unavailable && earlier) {
      const final = finalOf(earlier.answer, q);
      const unanswered = `${unavailable}, ${MODEL_SHORT[earlier.model]}'s answer kept`;
      return { ...base, final, settledBy: earlier.model, safeAction: null, note: noteOf(final, q), unanswered, kept: true };
    }
    const { final, safeAction } = safeFor(form, q);
    const unanswered = unavailable ? `${unavailable}, safe action taken` : null;
    return { ...base, final, settledBy: "safe" as const, safeAction, note: null, unanswered, kept: false };
  });

  return {
    ok: true,
    result: {
      formId: form.id,
      threshold: config.threshold,
      models: [...config.models],
      knowledge: boosters !== undefined,
      questions: results,
      calls,
      settledByFlash: results.filter((r) => r.settledBy === "flash" && !r.kept).length,
      safeActionTaken: results.some((r) => r.settledBy === "safe"),
      unavailable: unavailable ? summaryOf(unavailable, results) : null,
      outcome: outcomeOf(form, results),
    },
  };
}

/** An answer that can stand: one of the options, a level or a probability. */
function usable(answer: AnswerView): boolean {
  return answer.kind !== "none" && answer.kind !== "destination_unregistered";
}

/** The summary's notice when the last model could not answer: what happened, and what the questions it was to answer got. */
function summaryOf(unavailable: string, results: QuestionResult[]): string {
  const kept = [...new Set(results.filter((r) => r.kept).map((r) => r.settledBy as ModelKey))].map((m) => `${MODEL_SHORT[m]}'s answer kept`);
  const safe = results.some((r) => r.unanswered && !r.kept) ? ["safe action taken"] : [];
  return [unavailable, [...kept, ...safe].join(" and ")].filter(Boolean).join(", ");
}

/** The safe action of a question no model was sure of. */
export function safeFor(form: FormDef, q: AskedQuestion): { final: FinalAnswer; safeAction: string } {
  if (q.kind === "destination") {
    const team = form.teams.find((t) => t.id === form.triageTeam)!;
    return {
      final: { kind: "destination", teamId: team.id, teamName: team.name },
      safeAction: `Sent to ${team.name}, the team for what no model is sure of.`,
    };
  }
  if (q.kind === "urgency") {
    return { final: { kind: "urgency", label: "Unsure", level: null }, safeAction: "Urgency is shown as unsure." };
  }
  // never silently dropped: an unsure check lets the submission through and marks it for review
  return {
    final: { kind: "flag", value: null, label: "Unsure", raised: false },
    safeAction: `${q.title}: unsure, so the submission goes through and is marked for review.`,
  };
}

function finalOf(answer: AnswerView, q: AskedQuestion): FinalAnswer {
  switch (answer.kind) {
    case "destination":
      return { kind: "destination", teamId: answer.teamId, teamName: answer.teamName };
    case "urgency":
      return { kind: "urgency", label: answer.label, level: answer.level };
    case "flag":
      return { kind: "flag", value: answer.value, label: answer.label, raised: answer.value === q.flag!.flagWhen };
    default:
      throw new Error(`an answer of kind ${answer.kind} cannot be final`);
  }
}

function noteOf(final: FinalAnswer, q: AskedQuestion): string | null {
  return final.kind === "flag" && final.raised ? q.flag!.flagNote : null;
}

function outcomeOf(form: FormDef, results: QuestionResult[]): Outcome {
  const dest = results.find((r) => r.kind === "destination")!.final as Extract<FinalAnswer, { kind: "destination" }>;
  const team = form.teams.find((t) => t.id === dest.teamId)!;
  let deliver = true;
  let nextStep: string | null = null;
  let review = false;
  const notes: string[] = [];
  for (const r of results) {
    if (r.kind !== "flag") continue;
    const flag = form.flags.find((f) => f.id === r.id)!;
    if (r.settledBy === "safe") {
      review = true;
      if (r.safeAction) notes.push(r.safeAction);
      continue;
    }
    if (r.final.kind !== "flag" || !r.final.raised) continue;
    notes.push(flag.flagNote);
    if (flag.effect.kind === "hold") deliver = false;
    else if (flag.effect.kind === "review") review = true;
    else nextStep ??= flag.effect.outcome;
  }
  return { teamId: team.id, teamName: team.name, queue: team.queue ?? team.name, deliver, nextStep, notes, review };
}

function view(form: FormDef, q: AskedQuestion, raw: Answer | undefined): AnswerView {
  if (q.kind === "destination" && raw instanceof ChoiceAnswer) {
    const team = form.teams.find((t) => t.id === raw.choice);
    return team
      ? { kind: "destination", teamId: team.id, teamName: team.name }
      : { kind: "destination_unregistered", value: String(raw.choice) };
  }
  if (q.kind === "urgency" && raw instanceof ScoreAnswer && Number.isFinite(raw.score)) {
    const level = Math.min(URGENCY_LEVELS.length - 1, Math.max(0, Math.round(raw.score)));
    return { kind: "urgency", level, label: URGENCY_LEVELS[level].label, score: raw.score };
  }
  if (q.kind === "flag" && raw instanceof TruthAnswer && Number.isFinite(raw.truth)) {
    const value = raw.truth >= 0.5;
    return { kind: "flag", probability: raw.truth, value, label: value ? q.flag!.trueLabel : q.flag!.falseLabel };
  }
  return { kind: "none" };
}

function answeredCall(
  model: ModelKey,
  questions: string[],
  pictures: number,
  elapsedMs: number,
  d: Decision,
  knowledge: boolean,
): CallRecord {
  const cost = d.usage.cost;
  return {
    model,
    version: d.model ?? null,
    questions: [...questions],
    pictures,
    elapsedMs: Math.round(elapsedMs),
    serverMs: d.latencyMs,
    usage: {
      inputTokens: d.usage.inputTokens,
      outputTokens: d.usage.outputTokens,
      knowledgeTokens: d.usage.boosterTokens,
      costUsd: cost?.usd ?? null,
      modelUsd: cost?.modelUsd ?? null,
      boostersUsd: cost?.boostersUsd ?? null,
      freeTier: cost?.freeTier ?? null,
    },
    knowledge: knowledge ? (readKnowledge(d) ?? { status: "missing", passages: [], warnings: [] }) : null,
    requestId: d.requestId,
    error: null,
  };
}

function failedCall(
  model: ModelKey,
  questions: string[],
  pictures: number,
  elapsedMs: number,
  err: unknown,
  error: { message: string; retryable: boolean },
): CallRecord {
  const requestId = err && typeof err === "object" && "requestId" in err ? (err.requestId as string | null) : null;
  return {
    model,
    version: null,
    questions: [...questions],
    pictures,
    elapsedMs: Math.round(elapsedMs),
    serverMs: null,
    usage: null,
    knowledge: null,
    requestId,
    error: { message: error.message, retryable: error.retryable },
  };
}
