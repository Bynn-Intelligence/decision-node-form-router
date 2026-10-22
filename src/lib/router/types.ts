import type { ModelKey } from "./config";
import type { QuestionId } from "./questions";

/** One question's answer, as the result view shows it. */
export type AnswerView =
  | { kind: "destination"; teamId: string; teamName: string }
  | { kind: "destination_unregistered"; value: string }
  | { kind: "urgency"; level: number; label: string; score: number }
  | { kind: "spam"; probability: number; spam: boolean }
  | { kind: "none" };

export interface Attempt {
  model: ModelKey;
  /** Index into `RoutingResult.calls`. */
  call: number;
  answer: AnswerView;
  confidence: number;
  sure: boolean;
}

/** What the result does when no model was sure. */
export type SafeAction =
  | { question: "destination"; teamId: string; teamName: string }
  | { question: "urgency" }
  | { question: "spam" };

export type FinalAnswer =
  | { kind: "destination"; teamId: string; teamName: string }
  | { kind: "urgency"; label: string; level: number | null }
  | { kind: "spam"; spam: boolean; review: boolean };

export interface QuestionResult {
  id: QuestionId;
  attempts: Attempt[];
  final: FinalAnswer;
  /** The model whose answer is final, or `safe` when the safe action was taken. */
  settledBy: ModelKey | "safe";
  safeAction: SafeAction | null;
}

export interface CallUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  /** What the call cost in USD, as the API sent it; `null` when it sent none. */
  costUsd: number | null;
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
  questions: QuestionId[];
  /** Round trip measured here, retries included. */
  elapsedMs: number;
  /** The server's own time, when sent. */
  serverMs: number | null;
  usage: CallUsage | null;
  requestId: string | null;
  error: CallError | null;
}

export interface RoutingResult {
  formId: string;
  threshold: number;
  models: ModelKey[];
  questions: Record<QuestionId, QuestionResult>;
  calls: CallRecord[];
  /** How many of the three questions Flash settled. */
  settledByFlash: number;
  /** Whether any question took the safe action. */
  safeActionTaken: boolean;
  /** The team the submission goes to. */
  destination: { teamId: string; teamName: string };
  /** `false` when the submission was settled as spam: it is held, not delivered. */
  deliver: boolean;
}

export interface RoutingFailure {
  message: string;
  retryable: boolean;
  calls: CallRecord[];
}

export type RouteOutcome = { ok: true; result: RoutingResult } | { ok: false; error: RoutingFailure };
