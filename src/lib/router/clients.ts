import "server-only";
import { DecisionNode } from "@decisionnode/sdk";
import { MAX_RETRIES, MODEL_IDS, MODEL_TIMEOUTS, type ModelKey } from "./config";
import type { Deciders } from "./cascade";

// pictures always go inline, in the request itself: nothing is uploaded or stored
const INLINE_PICTURES = 25 * 1024 * 1024;

/** One SDK client per model, each with its own timeout per attempt and one retry. */
export function createDeciders(apiKey: string): Deciders {
  const client = (model: ModelKey) =>
    new DecisionNode({
      apiKey,
      model: MODEL_IDS[model],
      timeout: MODEL_TIMEOUTS[model],
      maxRetries: MAX_RETRIES,
      inlineThreshold: INLINE_PICTURES,
    });
  return { flash: client("flash"), moe: client("moe") };
}
