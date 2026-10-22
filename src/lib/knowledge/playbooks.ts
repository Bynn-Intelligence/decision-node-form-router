import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** The scope key of the knowledge base: each document is scoped to one form. */
export const SCOPE_KEY = "form";
export const BASE_NAME = "Form router playbooks";

/** One playbook document, ready to write. */
export interface Playbook {
  /** `<form>:<file name>`, the document's reference in the knowledge base. */
  reference: string;
  form: string;
  title: string;
  /** Markdown, as it is stored. */
  text: string;
  pinned: boolean;
  /** SHA-256 of the text, to tell an unchanged document. */
  sha256: string;
}

/** The text as the API stores it: line endings as `\n`, invisible control characters removed. */
export function normalise(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

/**
 * Reads one Markdown playbook: an optional front matter block with `title` and
 * `pinned`, then the text. Without a title the first heading is the title.
 */
export function parsePlaybook(form: string, file: string, source: string): Playbook {
  let body = normalise(source);
  const meta: Record<string, string> = {};
  const front = /^---\n([\s\S]*?)\n---\n/.exec(body);
  if (front) {
    for (const line of front[1].split("\n")) {
      const at = line.indexOf(":");
      if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    body = body.slice(front[0].length);
  }
  body = body.trim() + "\n";
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  const title = meta.title || heading || file;
  return {
    reference: `${form}:${file}`,
    form,
    title,
    text: body,
    pinned: meta.pinned === "true",
    sha256: createHash("sha256").update(body, "utf8").digest("hex"),
  };
}

/** Every playbook under `dir`, one folder per form, one Markdown file per document. */
export function readPlaybooks(dir: string): Playbook[] {
  const out: Playbook[] = [];
  for (const form of readdirSync(dir).sort()) {
    const folder = join(dir, form);
    if (!statSync(folder).isDirectory()) continue;
    for (const name of readdirSync(folder).sort()) {
      if (!name.endsWith(".md")) continue;
      out.push(parsePlaybook(form, name.replace(/\.md$/, ""), readFileSync(join(folder, name), "utf8")));
    }
  }
  return out;
}
