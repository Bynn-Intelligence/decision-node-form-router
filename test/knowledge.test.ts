import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORMS, FORM_IDS } from "@/lib/forms/definitions";
import { BASE_NAME, SCOPE_KEY, parsePlaybook, readPlaybooks, type Playbook } from "@/lib/knowledge/playbooks";
import { setupKnowledge, withEnvLine, type KbCollection, type KbItem, type KnowledgeApi } from "@/lib/knowledge/setup";

const KNOWLEDGE = join(__dirname, "..", "knowledge");

/** A fake collections API: one workspace in memory, documents ready as soon as they are written. */
function fakeApi(start: { collections?: KbCollection[]; items?: Record<string, KbItem[]> } = {}) {
  const collections = [...(start.collections ?? [])];
  const items: Record<string, KbItem[]> = { ...(start.items ?? {}) };
  const calls: string[] = [];
  let n = 0;
  const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
  const notFound = () => Object.assign(new Error("not found"), { status: 404 });

  const api: KnowledgeApi = {
    async list() {
      calls.push("list");
      return collections;
    },
    async get(id) {
      calls.push(`get ${id}`);
      const c = collections.find((x) => x.id === id);
      if (!c) throw notFound();
      return c;
    },
    async create({ name, type, scopeKey }) {
      calls.push(`create ${name} ${type} ${scopeKey}`);
      const c = { id: `col_${++n}`, type, name, scope_key: scopeKey };
      collections.push(c);
      items[c.id] = [];
      return c;
    },
    async listItems(id, { offset = 0, limit = 100 }) {
      const all = items[id] ?? [];
      const page = all.slice(offset, offset + limit);
      return { items: page, next_offset: offset + limit < all.length ? offset + limit : null };
    },
    async addDocument(id, p) {
      calls.push(`add ${p.reference}${p.pinned ? " pinned" : ""} ${p.metadata[SCOPE_KEY]}`);
      const item = { id: `itm_${++n}`, reference: p.reference, title: p.title, pinned: p.pinned, metadata: p.metadata, content_sha256: sha(p.document), status: "ready" };
      items[id].push(item);
      return item;
    },
    async replaceDocument(id, itemId, p) {
      calls.push(`replace ${p.reference}`);
      const item = items[id].find((i) => i.id === itemId)!;
      Object.assign(item, { title: p.title, pinned: p.pinned, metadata: p.metadata, content_sha256: sha(p.document) });
      return item;
    },
    async updateItem(id, itemId, p) {
      const item = items[id].find((i) => i.id === itemId)!;
      calls.push(`update ${item.reference}`);
      Object.assign(item, p);
      return item;
    },
    async deleteItem(id, itemId) {
      const item = items[id].find((i) => i.id === itemId)!;
      calls.push(`delete ${item.reference}`);
      items[id] = items[id].filter((i) => i.id !== itemId);
      return { deleted: true };
    },
    async waitUntilReady(id) {
      calls.push(`wait ${id}`);
      return collections.find((c) => c.id === id)!;
    },
  };
  return { api, calls, items, collections };
}

const playbooks: Playbook[] = [
  parsePlaybook("support", "always", "---\ntitle: Always\npinned: true\n---\n# Always\n\n- Locked accounts are critical.\n"),
  parsePlaybook("support", "billing", "---\ntitle: Billing\n---\n# Billing\n\nDouble charges.\n"),
  parsePlaybook("sales", "enterprise", "# Enterprise sales\r\n\r\nOver 200 people.\r\n"),
];

describe("the playbooks in the repository", () => {
  const all = readPlaybooks(KNOWLEDGE);

  it("hold a folder per form, with a pinned rules document and one document per team", () => {
    for (const id of FORM_IDS) {
      const docs = all.filter((p) => p.form === id);
      expect(docs.filter((p) => p.pinned).map((p) => p.reference)).toEqual([`${id}:always`]);
      for (const team of FORMS[id].teams) expect(docs.map((p) => p.reference), `${id}:${team.id}`).toContain(`${id}:${team.id}`);
    }
    expect(new Set(all.map((p) => p.form))).toEqual(new Set(FORM_IDS));
  });

  it("keep each form's pinned rules short enough for every request", () => {
    for (const p of all.filter((x) => x.pinned)) expect(p.text.split(/\s+/).length, p.reference).toBeLessThan(200);
  });

  it("use references and titles the API takes", () => {
    for (const p of all) {
      expect(p.reference).toMatch(/^[A-Za-z0-9_.:-]{1,64}$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.title.length).toBeLessThanOrEqual(200);
      expect(p.text).not.toContain(String.fromCharCode(0x2014));
    }
  });
});

describe("a playbook", () => {
  it("reads its front matter and normalises its text", () => {
    expect(playbooks[0]).toMatchObject({ reference: "support:always", title: "Always", pinned: true, form: "support" });
    expect(playbooks[0].text.startsWith("# Always")).toBe(true);
    expect(playbooks[2]).toMatchObject({ title: "Enterprise sales", pinned: false, text: "# Enterprise sales\n\nOver 200 people.\n" });
  });
});

describe("pnpm knowledge:setup", () => {
  it("creates one knowledge base scoped by form and writes every document, pinned and scoped as marked, then waits", async () => {
    const fake = fakeApi();
    const report = await setupKnowledge({ api: fake.api, playbooks });
    expect(report.created).toBe(true);
    expect(fake.calls).toEqual([
      "list",
      `create ${BASE_NAME} text form`,
      "add support:always pinned support",
      "add support:billing support",
      "add sales:enterprise sales",
      `wait ${report.baseId}`,
    ]);
    expect(report.added).toHaveLength(3);
  });

  it("skips unchanged documents on a second run", async () => {
    const fake = fakeApi();
    const first = await setupKnowledge({ api: fake.api, playbooks });
    fake.calls.length = 0;
    const second = await setupKnowledge({ api: fake.api, playbooks, baseId: first.baseId });
    expect(second.baseId).toBe(first.baseId);
    expect(second.created).toBe(false);
    expect(second.unchanged).toHaveLength(3);
    expect(fake.calls).toEqual([`get ${first.baseId}`, `wait ${first.baseId}`]);
  });

  it("rewrites a changed document, updates a changed pin and removes a playbook that is gone", async () => {
    const fake = fakeApi();
    const first = await setupKnowledge({ api: fake.api, playbooks });
    fake.items[first.baseId].push({ id: "itm_own", reference: "my-own-notes", status: "ready" });
    fake.calls.length = 0;
    const edited = [
      { ...playbooks[0], pinned: false },
      parsePlaybook("support", "billing", "---\ntitle: Billing\n---\n# Billing\n\nDouble charges and refunds.\n"),
    ];
    const report = await setupKnowledge({ api: fake.api, playbooks: edited, baseId: first.baseId });
    expect(report.updated).toEqual(["support:always"]);
    expect(report.replaced).toEqual(["support:billing"]);
    expect(report.removed).toEqual(["sales:enterprise"]);
    // a document the playbooks did not write is left alone
    expect(fake.items[first.baseId].map((i) => i.reference)).toContain("my-own-notes");
  });

  it("finds the knowledge base by name when the id in .env.local is gone", async () => {
    const fake = fakeApi({ collections: [{ id: "col_kept", type: "text", name: BASE_NAME, scope_key: "form" }], items: { col_kept: [] } });
    const report = await setupKnowledge({ api: fake.api, playbooks, baseId: "col_deleted" });
    expect(report).toMatchObject({ baseId: "col_kept", created: false });
  });

  it("reports documents that failed", async () => {
    const fake = fakeApi();
    const api: KnowledgeApi = {
      ...fake.api,
      async addDocument(id, p) {
        const item = await fake.api.addDocument(id, p);
        if (p.reference === "support:billing") Object.assign(item, { status: "failed", error: "embedding_rejected" });
        return item;
      },
    };
    const report = await setupKnowledge({ api, playbooks });
    expect(report.failed).toEqual([{ reference: "support:billing", error: "embedding_rejected" }]);
  });

  it("writes ROUTER_KNOWLEDGE_BASE to .env.local, replacing an old value", () => {
    expect(withEnvLine("", "ROUTER_KNOWLEDGE_BASE", "col_1")).toBe("ROUTER_KNOWLEDGE_BASE=col_1\n");
    expect(withEnvLine("DECISIONNODE_API_KEY=k", "ROUTER_KNOWLEDGE_BASE", "col_1")).toBe(
      "DECISIONNODE_API_KEY=k\nROUTER_KNOWLEDGE_BASE=col_1\n",
    );
    expect(withEnvLine("A=1\nROUTER_KNOWLEDGE_BASE=col_old\nB=2\n", "ROUTER_KNOWLEDGE_BASE", "col_new")).toBe(
      "A=1\nROUTER_KNOWLEDGE_BASE=col_new\nB=2\n",
    );
  });
});
