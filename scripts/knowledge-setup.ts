/**
 * pnpm knowledge:setup
 *
 * Loads the routing playbooks in knowledge/ into one knowledge base of your
 * workspace, scoped by form, waits until they are ready, and writes
 * ROUTER_KNOWLEDGE_BASE to .env.local. Run it again after editing a playbook:
 * unchanged documents are skipped.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DecisionNode, DecisionNodeError } from "@decisionnode/sdk";
import { readPlaybooks } from "../src/lib/knowledge/playbooks";
import { setupKnowledge, withEnvLine, type KnowledgeApi } from "../src/lib/knowledge/setup";

const ROOT = join(import.meta.dirname, "..");
const ENV_FILE = join(ROOT, ".env.local");

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

async function main() {
  for (const file of [".env.local", ".env"]) {
    if (existsSync(join(ROOT, file))) process.loadEnvFile(join(ROOT, file));
  }
  const apiKey = process.env.DECISIONNODE_API_KEY?.trim();
  if (!apiKey) fail("Set DECISIONNODE_API_KEY in .env.local first. Make a key at https://decisionnode.com/console/keys.");

  const api: KnowledgeApi = new DecisionNode({ apiKey }).collections;

  const playbooks = readPlaybooks(join(ROOT, "knowledge"));
  console.log(`Loading ${playbooks.length} playbook documents for ${new Set(playbooks.map((p) => p.form)).size} forms.`);

  const report = await setupKnowledge({
    api,
    playbooks,
    baseId: process.env.ROUTER_KNOWLEDGE_BASE?.trim() || null,
    log: (line) => console.log(line),
  });

  const source = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  writeFileSync(ENV_FILE, withEnvLine(source, "ROUTER_KNOWLEDGE_BASE", report.baseId));

  console.log(
    `\nKnowledge base ${report.baseId}: ${report.added.length} added, ${report.replaced.length} rewritten, ` +
      `${report.updated.length} updated, ${report.unchanged.length} unchanged, ${report.removed.length} removed.`,
  );
  for (const f of report.failed) console.error(`  ${f.reference} failed: ${f.error}`);
  console.log(`\nWrote ROUTER_KNOWLEDGE_BASE=${report.baseId} to .env.local. Restart pnpm dev to route by the playbooks.`);
  console.log("On Vercel, set ROUTER_KNOWLEDGE_BASE to the same value under Settings, Environment Variables, and redeploy.");
  if (report.failed.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof DecisionNodeError) {
    if (err.errorType === "key_scope_denied" || err.status === 403) {
      fail(`The key may not write knowledge bases (${err.message}). Use a Full access key.`);
    }
    if (err.status === 401) fail("The API key was not accepted. Check DECISIONNODE_API_KEY.");
    fail(`The API answered ${err.status ?? "nothing"}: ${err.message || err.errorType || "no message"}`);
  }
  fail(err instanceof Error ? err.message : String(err));
});
