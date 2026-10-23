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
  /** The document's `content_sha256` as the API computes it, to tell an unchanged document. */
  sha256: string;
}

/** The format every playbook is written in. */
export const FORMAT = "markdown";

/** The text as the API stores it: line endings as `\n`, control characters (C0, DEL and C1) removed except tab and line feed. */
export function normalise(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

/**
 * A document's `content_sha256` as the API computes it: SHA-256 over the
 * stored text, the format and the title, in that order, each preceded by its
 * UTF-8 length in bytes as an unsigned 64-bit big-endian integer.
 */
export function contentHash(text: string, format: string, title: string): string {
  const hash = createHash("sha256");
  for (const part of [text, format, title]) {
    const bytes = Buffer.from(part, "utf8");
    const length = Buffer.alloc(8);
    length.writeBigUInt64BE(BigInt(bytes.length));
    hash.update(length);
    hash.update(bytes);
  }
  return hash.digest("hex");
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
    sha256: contentHash(body, FORMAT, title),
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
