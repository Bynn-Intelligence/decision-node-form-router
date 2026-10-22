import { Decision } from "@decisionnode/sdk";
import type { DecideParams, Decider, Deciders } from "@/lib/router/cascade";
import type { ModelKey } from "@/lib/router/config";

/** A wire-form answer per question id, as the API would send it. */
export type WireAnswers = Record<string, Record<string, unknown>>;

export interface RecordedCall {
  model: string;
  questions: string[];
  fallback: boolean | undefined;
  state: unknown;
  images: string[];
  boosters: unknown;
}

type Script = WireAnswers | Error | ((params: DecideParams) => WireAnswers | Error);

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

/** What a knowledge reading cites, as the API sends it with `include_text`. */
export const PASSAGES = [
  { n: 1, pinned: true, item: "itm_1", reference: "support/always", title: "Always", heading: "Locked accounts", text: "A locked account is critical.", rendered: true },
  { n: 2, pinned: false, item: "itm_2", reference: "support/billing", title: "Billing", heading: "Double charges", text: "Double charges go to Billing.", rendered: true },
];

/**
 * A fake API client per model. Each answers only the questions it was asked,
 * from its script, and builds a real SDK `Decision` from the wire body, so the
 * router reads its answers just like answers from the API. With the knowledge
 * booster it cites two passages. No network.
 */
export function fakeDeciders(scripts: Partial<Record<ModelKey, Script>>, usage?: Record<string, unknown>) {
  const calls: RecordedCall[] = [];
  const make = (key: ModelKey): Decider => ({
    async decide(params) {
      const questions = Object.keys(params.questions);
      calls.push({
        model: params.model,
        questions,
        fallback: params.fallback,
        state: params.state,
        images: (params.images ?? []).map((i) => i.id),
        boosters: params.boosters,
      });
      const script = scripts[key];
      if (script === undefined) throw new Error(`no script for ${key}`);
      const outcome = typeof script === "function" ? script(params) : script;
      if (outcome instanceof Error) throw outcome;
      const answers = Object.fromEntries(questions.filter((q) => outcome[q]).map((q) => [q, outcome[q]]));
      const knowledge = params.boosters
        ? { knowledge: { version: "knowledge-v1", status: "ok", billed_calls: 1, results: [{ warnings: [], passages: PASSAGES }] } }
        : undefined;
      return new Decision(
        {
          model: `${params.model}-test`,
          answers,
          ...(knowledge ? { evidence: knowledge } : {}),
          usage: usage ?? {
            input_tokens: 420,
            output_tokens: 0,
            ...(knowledge ? { booster_tokens: 30, boosters: 1 } : {}),
            cost: {
              usd: knowledge ? 0.001002604 : 0.000002604,
              model_usd: 0.000002604,
              boosters_usd: knowledge ? 0.001 : 0,
              free_tier: false,
            },
          },
        },
        { "x-request-id": `req_${key}_${calls.length}`, "x-decisionnode-latency-ms": "19" },
      );
    },
  });
  const clients: Deciders = { flash: make("flash"), moe: make("moe") };
  return { clients, calls };
}
