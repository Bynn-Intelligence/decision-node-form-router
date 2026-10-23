import "server-only";
import { DecisionNode, type ClientOptions } from "@decisionnode/sdk";
import { MODEL_IDS, MODEL_RETRIES, MODEL_TIMEOUTS, type ModelKey } from "./config";
import type { Deciders } from "./cascade";

// pictures always go inline, in the request itself: nothing is uploaded or stored
const INLINE_PICTURES = 25 * 1024 * 1024;

/** A model's client: its own timeout per attempt; Flash retries once, the re-check never. */
export function clientOptions(apiKey: string, model: ModelKey): ClientOptions {
  return {
    apiKey,
    model: MODEL_IDS[model],
    timeout: MODEL_TIMEOUTS[model],
    maxRetries: MODEL_RETRIES[model],
    inlineThreshold: INLINE_PICTURES,
  };
}

/** One SDK client per model. */
export function createDeciders(apiKey: string): Deciders {
  return { flash: new DecisionNode(clientOptions(apiKey, "flash")), moe: new DecisionNode(clientOptions(apiKey, "moe")) };
}
