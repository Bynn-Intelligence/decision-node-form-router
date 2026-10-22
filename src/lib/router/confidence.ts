import { ChoiceAnswer, ScoreAnswer, TruthAnswer, type Answer } from "@decisionnode/sdk";

/**
 * How sure an answer is, on one 0 to 1 scale for every question type:
 * `confidence` for a choice or a score, and the distance from 0.5 for a
 * truth (`|2p - 1|`), so 0.5 is 0 and both 0 and 1 are 1.
 */
export function confidenceOf(answer: Answer | undefined): number {
  if (answer instanceof ChoiceAnswer || answer instanceof ScoreAnswer) {
    return finite(answer.confidence) ? clamp(answer.confidence) : 0;
  }
  if (answer instanceof TruthAnswer) {
    // rounded so 0.85 reads as 0.7, not 0.7 less a rounding error
    return finite(answer.truth) ? clamp(Math.round(Math.abs(2 * answer.truth - 1) * 1e9) / 1e9) : 0;
  }
  return 0;
}

/** Final when its confidence reaches the threshold. */
export function isSure(confidence: number, threshold: number): boolean {
  return confidence >= threshold;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}
