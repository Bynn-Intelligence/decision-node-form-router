import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORMS, FORM_IDS } from "@/lib/forms/definitions";
import type { FormDef, TeamDef } from "@/lib/forms/types";
import { readPlaybooks } from "@/lib/knowledge/playbooks";

/**
 * The registry routes by itself where no model is asked: a team's queue, and
 * the criteria the model reads beside the rules. These tests hold the registry
 * to what each form's playbook says, wherever that can be read mechanically.
 */
const playbooks = readPlaybooks(join(__dirname, "..", "knowledge"));

function sentences(form: string, pinned: boolean): string[] {
  return playbooks
    .filter((p) => p.form === form && p.pinned === pinned)
    .flatMap((p) => p.text.split("\n"))
    .filter((line) => line.startsWith("- "))
    .flatMap((line) => line.slice(2).split(/(?<=\.)\s+/));
}

/** The teams a sentence names, by their names in the registry. */
function named(form: FormDef, text: string): TeamDef[] {
  const lower = text.toLowerCase();
  return form.teams.filter((t) => lower.includes(t.name.toLowerCase()));
}

function queue(team: TeamDef): string {
  return team.queue ?? team.name;
}

describe.each(FORM_IDS)("the %s registry agrees with its pinned rules", (id) => {
  const form: FormDef = FORMS[id];
  const rules = sentences(id, true);

  it("sends what the rules do not accept where the rules say, not with what they accept", () => {
    const accepted = rules.filter((s) => /\baccepts\b/i.test(s)).flatMap((s) => named(form, s));
    for (const s of rules.filter((x) => /\bnot accepted\b/i.test(x))) {
      const [subject, target] = s.split(/\broute it to\b|\bgoes to\b/i);
      const refused = named(form, subject);
      const to = target ? named(form, target) : [];
      expect(refused.length, s).toBeGreaterThan(0);
      for (const team of refused) {
        for (const ok of accepted) expect(queue(team), `${team.name} in "${s}"`).not.toBe(queue(ok));
        for (const t of to) expect(queue(team), `${team.name} in "${s}"`).toBe(queue(t));
      }
    }
  });

  it("gives what the rules accept one queue", () => {
    for (const s of rules.filter((x) => /\baccepts\b/i.test(x))) {
      const queues = new Set(named(form, s).map(queue));
      expect(queues.size, s).toBeLessThanOrEqual(1);
    }
  });

  it("never lists, in a team's criteria, what a rule says that team does not get", () => {
    for (const s of rules) {
      const m = /^(?:A|An)\s+(.+?)\s+goes to\s+[A-Z][\w ]*?,\s+never to\s+([A-Z][\w ]*?)\./.exec(s);
      if (!m) continue;
      const [, thing, other] = m;
      const team = form.teams.find((t) => t.name === other);
      expect(team, `"${other}" in "${s}" is a team`).toBeDefined();
      expect(team!.criteria.toLowerCase(), s).not.toContain(thing.toLowerCase());
    }
  });

  it("agrees with the team documents that say whether a document is accepted", () => {
    const say = (pattern: RegExp) =>
      playbooks
        .filter((p) => p.form === id && !p.pinned && pattern.test(p.text))
        .map((p) => form.teams.find((t) => `${id}:${t.id}` === p.reference))
        .filter((t): t is TeamDef => t !== undefined);
    const refused = say(/\bnot accepted\b/i);
    const accepted = say(/(?<!not )\baccepted for\b/i).filter((t) => !refused.includes(t));
    for (const r of refused) for (const a of accepted) expect(queue(r), r.name).not.toBe(queue(a));
  });
});

describe("the identity form", () => {
  it("sends a driving licence to Manual review, as the rules say", () => {
    const licence = FORMS.identity.teams.find((t) => t.id === "driving_licence")!;
    expect(queue(licence)).toBe("Manual review");
  });
});

describe("the bug report form", () => {
  it("leaves a sign-in loop to Platform: Identity's criteria do not claim it", () => {
    const identity = FORMS.bugs.teams.find((t) => t.id === "identity")!;
    expect(identity.criteria.toLowerCase()).not.toMatch(/loop|sessions? that end/);
  });
});
