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

export function formatInt(n: number): string {
  return whole.format(n);
}

/** A call's tokens: input (pictures and the rules' passages included) and the rules' share. */
export function formatTokens(call: CallRecord): string | null {
  const u = call.usage;
  if (!u || u.inputTokens === null) return null;
  const parts = [`${whole.format(u.inputTokens)} tokens in`];
  if (u.knowledgeTokens) parts.push(`${whole.format(u.knowledgeTokens)} of them rules`);
  return parts.join(", ");
}

/** What one call cost: the API's own amount when it sent one, with the knowledge call's part; else its tokens. */
export function formatCallCost(call: CallRecord): string {
  const u = call.usage;
  if (!u) return "Not billed";
  if (u.costUsd !== null) {
    const total = u.freeTier && u.costUsd === 0 ? "Free tier" : formatUsd(u.costUsd);
    if (u.boostersUsd && u.modelUsd !== null) return `${total}: model ${formatUsd(u.modelUsd)}, knowledge ${formatUsd(u.boostersUsd)}`;
    return total;
  }
  return formatTokens(call) ?? "No usage sent";
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

export function totalTokens(calls: CallRecord[]): number | null {
  let input: number | null = null;
  for (const c of calls) if (c.usage?.inputTokens != null) input = (input ?? 0) + c.usage.inputTokens;
  return input;
}

export function describeModels(models: readonly ModelKey[]): string {
  if (models.length === 2) return "Flash, then DecisionNode";
  return models[0] === "moe" ? "DecisionNode only" : "Flash only";
}
