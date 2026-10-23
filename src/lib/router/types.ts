import type { ModelKey } from "./config";
import type { QuestionKind } from "./questions";

/** One model's answer to one question, as the result view shows it. */
export type AnswerView =
  | { kind: "destination"; teamId: string; teamName: string }
  | { kind: "destination_unregistered"; value: string }
  | { kind: "urgency"; level: number; label: string; score: number }
  | { kind: "flag"; probability: number; value: boolean; label: string }
  | { kind: "none" };

export interface Attempt {
  model: ModelKey;
  /** Index into `RoutingResult.calls`. */
  call: number;
  answer: AnswerView;
  confidence: number;
  sure: boolean;
}

export type FinalAnswer =
  | { kind: "destination"; teamId: string; teamName: string }
  | { kind: "urgency"; label: string; level: number | null }
  /** `value` is `null` when no model was sure; `raised` says whether the flag is up. */
  | { kind: "flag"; value: boolean | null; label: string; raised: boolean };

export interface QuestionResult {
  id: string;
  kind: QuestionKind;
  title: string;
  attempts: Attempt[];
  final: FinalAnswer;
  /** The model whose answer is final, or `safe` when the safe action was taken. */
  settledBy: ModelKey | "safe";
  /** What the safe action did, in words; `null` when a model settled it. */
  safeAction: string | null;
  /** For a flag that is up: what the result says about it. */
  note: string | null;
  /** When the last model could not answer this question: why, and what it got, such as "DecisionNode was busy, Flash's answer kept". */
  unanswered: string | null;
  /** `true` when an earlier model's answer below the threshold was kept, because the last model could not answer. */
  kept: boolean;
}

/** A passage of the routing rules a call read, as the API cited it. */
export interface Passage {
  n: number;
  pinned: boolean;
  title: string | null;
  heading: string | null;
  reference: string | null;
  /** The passage's text, when the API sent it. */
  text: string | null;
}

export interface KnowledgeRead {
  status: string;
  passages: Passage[];
  warnings: string[];
}

export interface CallUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  /** The share of `inputTokens` the routing rules took. */
  knowledgeTokens: number | null;
  /** What the call cost in USD, as the API sent it; `null` when it sent none. */
  costUsd: number | null;
  /** Its parts: the model, and the knowledge call. */
  modelUsd: number | null;
  boostersUsd: number | null;
  freeTier: boolean | null;
}

export interface CallError {
  message: string;
  retryable: boolean;
}

export interface CallRecord {
  model: ModelKey;
  /** The pinned version that answered, as the API named it. */
  version: string | null;
  questions: string[];
  pictures: number;
  /** Round trip measured here, retries included. */
  elapsedMs: number;
  /** The server's own time, when sent. */
  serverMs: number | null;
  usage: CallUsage | null;
  /** The routing rules this call read; `null` when it named no knowledge base. */
  knowledge: KnowledgeRead | null;
  requestId: string | null;
  error: CallError | null;
}

/** Where the submission ends up. */
export interface Outcome {
  teamId: string;
  teamName: string;
  /** Where it goes: the team's queue, or the team's name. */
  queue: string;
  /** `false` when a check held it, such as spam: shown, never delivered. */
  deliver: boolean;
  /** A next step a check asked for, such as asking for a clearer photo. */
  nextStep: string | null;
  /** What the flags that are up, and the unsure checks, say. */
  notes: string[];
  /** Marked for a person to review: a flag up for review, or a check no model was sure of. */
  review: boolean;
}

export interface RoutingResult {
  formId: string;
  threshold: number;
  models: ModelKey[];
  /** Whether the requests read the routing rules. */
  knowledge: boolean;
  questions: QuestionResult[];
  calls: CallRecord[];
  /** How many questions Flash settled. */
  settledByFlash: number;
  /** Whether any question took the safe action. */
  safeActionTaken: boolean;
  /** When the last model could not answer: why, for the summary; `null` when every model answered. */
  unavailable: string | null;
  outcome: Outcome;
}

export interface RoutingFailure {
  message: string;
  retryable: boolean;
  calls: CallRecord[];
}

export type RouteOutcome = { ok: true; result: RoutingResult } | { ok: false; error: RoutingFailure };
