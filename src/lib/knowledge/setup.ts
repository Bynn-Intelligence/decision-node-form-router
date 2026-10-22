import { BASE_NAME, SCOPE_KEY, type Playbook } from "./playbooks";

/** A knowledge base, as the API sends it. */
export interface KbCollection {
  id: string;
  type: string;
  name: string;
  scope_key?: string | null;
  status_counts?: { queued?: number; processing?: number; ready?: number; failed?: number };
  [field: string]: unknown;
}

/** A document, as the API sends it. */
export interface KbItem {
  id: string;
  reference: string;
  title?: string;
  pinned?: boolean;
  metadata?: Record<string, string | number | boolean>;
  content_sha256?: string;
  status?: string;
  error?: string | null;
  [field: string]: unknown;
}

interface DocumentWrite {
  document: string;
  title: string;
  reference: string;
  pinned: boolean;
  metadata: Record<string, string>;
}

/** The SDK's collections calls the setup uses, by their SDK names, so a fake can stand in for them. */
export interface KnowledgeApi {
  list(): Promise<KbCollection[]>;
  get(id: string): Promise<KbCollection>;
  create(params: { name: string; type: "text"; scopeKey: string }): Promise<KbCollection>;
  listItems(id: string, params: { offset?: number; limit?: number }): Promise<{ items: KbItem[]; next_offset: number | null }>;
  addDocument(id: string, params: DocumentWrite): Promise<KbItem>;
  replaceDocument(id: string, itemId: string, params: DocumentWrite): Promise<KbItem>;
  updateItem(id: string, itemId: string, params: { pinned?: boolean; metadata?: Record<string, string> }): Promise<KbItem>;
  deleteItem(id: string, itemId: string): Promise<unknown>;
  waitUntilReady(id: string, params?: { timeout?: number }): Promise<KbCollection>;
}

export interface SetupReport {
  baseId: string;
  created: boolean;
  added: string[];
  replaced: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
  failed: { reference: string; error: string }[];
}

export interface SetupInput {
  api: KnowledgeApi;
  playbooks: Playbook[];
  /** The knowledge base already set in `ROUTER_KNOWLEDGE_BASE`, if any. */
  baseId?: string | null;
  /** Milliseconds to wait for every document to be ready. */
  timeout?: number;
  log?: (line: string) => void;
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "status" in err && (err as { status: unknown }).status === 404;
}

async function findBase(api: KnowledgeApi, baseId: string | null | undefined, log: (l: string) => void) {
  if (baseId) {
    try {
      const base = await api.get(baseId);
      if (base.type === "text" && base.scope_key === SCOPE_KEY) return base;
      log(`${baseId} is not a knowledge base scoped by "${SCOPE_KEY}"; looking for "${BASE_NAME}".`);
    } catch (err) {
      if (!isNotFound(err)) throw err;
      log(`${baseId} was not found in this workspace; looking for "${BASE_NAME}".`);
    }
  }
  const all = await api.list();
  return all.find((c) => c.type === "text" && c.name === BASE_NAME && c.scope_key === SCOPE_KEY) ?? null;
}

async function allItems(api: KnowledgeApi, id: string): Promise<KbItem[]> {
  const items: KbItem[] = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await api.listItems(id, { offset, limit: 100 });
    items.push(...page.items);
    offset = page.next_offset;
  }
  return items;
}

/** Whether a document belongs to the playbooks: its reference is `<form>:<file>`. */
function isPlaybookReference(reference: string): boolean {
  return /^[a-z0-9_]+:[A-Za-z0-9_.-]+$/.test(reference);
}

/**
 * Loads the playbooks into one knowledge base scoped by form: creates the
 * base when there is none, adds new documents, rewrites changed ones, updates
 * a changed pin, skips unchanged ones, removes playbook documents that no
 * longer exist, and waits until every document is ready. Safe to run again.
 */
export async function setupKnowledge({ api, playbooks, baseId, timeout = 300_000, log = () => {} }: SetupInput): Promise<SetupReport> {
  let base = await findBase(api, baseId, log);
  let created = false;
  if (!base) {
    base = await api.create({ name: BASE_NAME, type: "text", scopeKey: SCOPE_KEY });
    created = true;
    log(`Created the knowledge base "${BASE_NAME}" (${base.id}).`);
  }

  const report: SetupReport = { baseId: base.id, created, added: [], replaced: [], updated: [], unchanged: [], removed: [], failed: [] };
  const existing = new Map((await allItems(api, base.id)).map((item) => [item.reference, item]));

  for (const p of playbooks) {
    const write: DocumentWrite = { document: p.text, title: p.title, reference: p.reference, pinned: p.pinned, metadata: { [SCOPE_KEY]: p.form } };
    const item = existing.get(p.reference);
    existing.delete(p.reference);
    if (!item) {
      await api.addDocument(base.id, write);
      report.added.push(p.reference);
    } else if (item.content_sha256 !== p.sha256 || item.title !== p.title) {
      await api.replaceDocument(base.id, item.id, write);
      report.replaced.push(p.reference);
    } else if ((item.pinned ?? false) !== p.pinned || item.metadata?.[SCOPE_KEY] !== p.form) {
      await api.updateItem(base.id, item.id, { pinned: p.pinned, metadata: { [SCOPE_KEY]: p.form } });
      report.updated.push(p.reference);
    } else {
      report.unchanged.push(p.reference);
    }
  }

  for (const [reference, item] of existing) {
    if (!isPlaybookReference(reference)) continue;
    await api.deleteItem(base.id, item.id);
    report.removed.push(reference);
  }

  log("Waiting until every document is ready...");
  await api.waitUntilReady(base.id, { timeout });
  for (const item of await allItems(api, base.id)) {
    if (item.status === "failed") report.failed.push({ reference: item.reference, error: item.error ?? "unknown" });
  }
  return report;
}

/** `.env.local` with `key=value` set: the line replaced when it is there, added when not. */
export function withEnvLine(source: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  const sep = source === "" || source.endsWith("\n") ? "" : "\n";
  return `${source}${sep}${line}\n`;
}
