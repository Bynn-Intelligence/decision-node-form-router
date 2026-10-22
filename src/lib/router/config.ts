export type ModelKey = "flash" | "moe";

export const MODEL_IDS: Record<ModelKey, string> = {
  flash: "decisionnode-flash",
  moe: "decisionnode-moe",
};

export const MODEL_NAMES: Record<ModelKey, string> = {
  flash: "DecisionNode Flash",
  moe: "DecisionNode",
};

/** Milliseconds per attempt. */
export const MODEL_TIMEOUTS: Record<ModelKey, number> = {
  flash: 5_000,
  moe: 10_000,
};

/** Retries after the first attempt, done by the SDK on a retryable failure. */
export const MAX_RETRIES = 1;

export const DEFAULT_THRESHOLD = 0.7;
export const DEFAULT_MODELS: readonly ModelKey[] = ["flash", "moe"];

const MODEL_SETTINGS: Record<string, readonly ModelKey[]> = {
  "flash,moe": ["flash", "moe"],
  moe: ["moe"],
  flash: ["flash"],
};

export interface RouterConfig {
  apiKey: string;
  models: readonly ModelKey[];
  threshold: number;
  /** The knowledge base with the routing rules; `null` routes on the team criteria alone. */
  knowledgeBase: string | null;
}

export type ConfigResult =
  | { ok: true; config: RouterConfig }
  | { ok: false; reason: "missing_key" }
  | { ok: false; reason: "invalid"; problems: string[] };

type Env = Record<string, string | undefined>;

function blank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/** Reads the router's settings from the environment. Nothing routes without an API key. */
export function readConfig(env: Env): ConfigResult {
  const apiKey = env.DECISIONNODE_API_KEY?.trim() ?? "";
  if (apiKey === "") return { ok: false, reason: "missing_key" };

  const problems: string[] = [];

  let models = DEFAULT_MODELS;
  if (!blank(env.ROUTER_MODELS)) {
    const key = env.ROUTER_MODELS!.toLowerCase().replace(/\s+/g, "");
    const setting = MODEL_SETTINGS[key];
    if (setting) models = setting;
    else problems.push(`ROUTER_MODELS is "${env.ROUTER_MODELS}"; use flash,moe, moe or flash.`);
  }

  let threshold = DEFAULT_THRESHOLD;
  if (!blank(env.ROUTER_THRESHOLD)) {
    const n = Number(env.ROUTER_THRESHOLD);
    if (Number.isFinite(n) && n >= 0 && n <= 1) threshold = n;
    else problems.push(`ROUTER_THRESHOLD is "${env.ROUTER_THRESHOLD}"; use a number from 0 to 1, such as 0.7.`);
  }

  const knowledgeBase = blank(env.ROUTER_KNOWLEDGE_BASE) ? null : env.ROUTER_KNOWLEDGE_BASE!.trim();

  if (problems.length > 0) return { ok: false, reason: "invalid", problems };
  return { ok: true, config: { apiKey, models, threshold, knowledgeBase } };
}

/** The settings without the key, safe to show in the page. */
export function publicSettings(config: RouterConfig) {
  return { models: [...config.models], threshold: config.threshold, knowledge: config.knowledgeBase !== null };
}
