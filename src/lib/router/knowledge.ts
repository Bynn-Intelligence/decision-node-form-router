import type { KnowledgeRead, Passage } from "./types";

/**
 * The `knowledge` booster for one form: the routing rules of the knowledge
 * base, scoped to the form, with each passage's text for the result view.
 * `require` makes the request fail rather than route without the rules.
 */
export function knowledgeBooster(collection: string, formId: string) {
  return {
    name: "knowledge",
    require: true,
    options: { collection, scope: formId, include_text: true },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function text(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** The passages a decision read, from its `evidence.knowledge`; `null` when it has none. */
export function readKnowledge(raw: Record<string, unknown>): KnowledgeRead | null {
  const evidence = raw.evidence;
  if (!isObject(evidence) || !isObject(evidence.knowledge)) return null;
  const reading = evidence.knowledge;
  const results = Array.isArray(reading.results) ? reading.results.filter(isObject) : [];
  const passages: Passage[] = [];
  const warnings: string[] = [];
  for (const result of results) {
    if (Array.isArray(result.warnings)) warnings.push(...result.warnings.filter((w): w is string => typeof w === "string"));
    for (const p of Array.isArray(result.passages) ? result.passages.filter(isObject) : []) {
      if (p.rendered === false) continue;
      passages.push({
        n: typeof p.n === "number" ? p.n : passages.length + 1,
        pinned: p.pinned === true,
        title: text(p.title),
        heading: text(p.heading),
        reference: text(p.reference),
        text: text(p.text),
      });
    }
  }
  return { status: text(reading.status) ?? "ok", passages, warnings };
}
