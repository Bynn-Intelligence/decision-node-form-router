import type { ModelKey } from "./router/config";
import type { CallRecord } from "./router/types";

export const MODEL_SHORT: Record<ModelKey, string> = { flash: "Flash", moe: "DecisionNode" };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumSignificantDigits: 2 });
const whole = new Intl.NumberFormat("en-US");

export function formatUsd(n: number): string {
  return n === 0 ? "$0" : usd.format(n);
}

export function formatMs(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`;
}

export function formatConfidence(n: number): string {
  return n.toFixed(2);
}

export function formatTokens(input: number | null, output: number | null): string | null {
  if (input === null && output === null) return null;
  const parts = [];
  if (input !== null) parts.push(`${whole.format(input)} in`);
  if (output !== null) parts.push(`${whole.format(output)} out`);
  return `${parts.join(", ")} tokens`;
}

/** What one call cost: the API's own amount when it sent one, else its tokens. */
export function formatCallCost(call: CallRecord): string {
  if (!call.usage) return "Not billed";
  if (call.usage.freeTier) return "Free tier";
  if (call.usage.costUsd !== null) return formatUsd(call.usage.costUsd);
  return formatTokens(call.usage.inputTokens, call.usage.outputTokens) ?? "No usage sent";
}

/** The sum of the calls' costs, only when every answered call carried one. */
export function totalCost(calls: CallRecord[]): number | null {
  const answered = calls.filter((c) => c.usage);
  if (answered.length === 0) return null;
  let sum = 0;
  for (const c of answered) {
    if (c.usage!.costUsd === null) return null;
    sum += c.usage!.costUsd;
  }
  return sum;
}

export function totalTokens(calls: CallRecord[]): string | null {
  let input: number | null = null;
  let output: number | null = null;
  for (const c of calls) {
    if (c.usage?.inputTokens != null) input = (input ?? 0) + c.usage.inputTokens;
    if (c.usage?.outputTokens != null) output = (output ?? 0) + c.usage.outputTokens;
  }
  return formatTokens(input, output);
}

export function describeModels(models: readonly ModelKey[]): string {
  if (models.length === 2) return "Flash, then DecisionNode";
  return models[0] === "moe" ? "DecisionNode only" : "Flash only";
}
