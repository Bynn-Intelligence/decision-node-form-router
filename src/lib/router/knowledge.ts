import { KnowledgeReading, knowledge, type Booster, type Decision } from "@decisionnode/sdk";
import type { KnowledgeRead } from "./types";

/**
 * The `knowledge` booster for one form: the routing rules of the knowledge
 * base, scoped to the form, with each passage's text for the result view.
 * `require` makes the request fail rather than route without the rules.
 */
export function knowledgeBooster(collection: string, formId: string): Booster {
  return knowledge(collection, { scope: formId, includeText: true, require: true });
}

/** The passages a decision read, from its `evidence.knowledge`; `null` when it has none. */
export function readKnowledge(decision: Decision): KnowledgeRead | null {
  const evidence = decision.evidence?.knowledge;
  if (!evidence) return null;
  const readings = evidence.results.filter((r): r is KnowledgeReading => r instanceof KnowledgeReading);
  return {
    status: evidence.status ?? "ok",
    warnings: readings.flatMap((r) => r.warnings),
    passages: readings.flatMap((r) =>
      r.passages
        .filter((p) => p.rendered !== false)
        .map((p) => ({ n: p.n, pinned: p.pinned, title: p.title, heading: p.heading, reference: p.reference, text: p.text })),
    ),
  };
}
