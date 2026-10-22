import { Decision } from "@decisionnode/sdk";
import type { Decider, Deciders } from "@/lib/router/cascade";
import type { ModelKey } from "@/lib/router/config";
import type { QuestionId } from "@/lib/router/questions";

/** A wire-form answer per question, as the API would send it. */
export type WireAnswers = Partial<Record<QuestionId, Record<string, unknown>>>;

export interface RecordedCall {
  model: string;
  questions: QuestionId[];
  fallback: boolean | undefined;
  state: unknown;
}

type Script = WireAnswers | Error | (() => WireAnswers | Error);

export function choiceAnswer(choice: string, confidence: number) {
  return { type: "choice", choice, confidence, probabilities: { [choice]: confidence } };
}

export function scoreAnswer(score: number, confidence: number) {
  const legend = { 0: "Low", 1: "Normal", 2: "High", 3: "Critical" };
  return { type: "score", score, confidence, probabilities: { [Math.round(score)]: confidence }, legend };
}

export function truthAnswer(truth: number) {
  return { type: "truth", truth };
}

/**
 * A fake API client per model. Each answers only the questions it was asked,
 * from its script, and builds a real SDK `Decision` from the wire body, so the
 * router reads its answers just like answers from the API. No network.
 */
export function fakeDeciders(scripts: Partial<Record<ModelKey, Script>>, usage?: Record<string, unknown>) {
  const calls: RecordedCall[] = [];
  const make = (key: ModelKey): Decider => ({
    async decide(params) {
      const questions = Object.keys(params.questions) as QuestionId[];
      calls.push({ model: params.model, questions, fallback: params.fallback, state: params.state });
      const script = scripts[key];
      if (script === undefined) throw new Error(`no script for ${key}`);
      const outcome = typeof script === "function" ? script() : script;
      if (outcome instanceof Error) throw outcome;
      const answers = Object.fromEntries(questions.filter((q) => outcome[q]).map((q) => [q, outcome[q]]));
      return new Decision(
        {
          model: `${params.model}-test`,
          answers,
          usage: usage ?? {
            input_tokens: 420,
            output_tokens: questions.length,
            cost: { usd: 0.000002604, model_usd: 0.000002604, boosters_usd: 0, free_tier: false },
          },
        },
        { "x-request-id": `req_${key}_${calls.length}`, "x-decisionnode-latency-ms": "19" },
      );
    },
  });
  const clients: Deciders = { flash: make("flash"), moe: make("moe") };
  return { clients, calls };
}
