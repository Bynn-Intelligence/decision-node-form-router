import { describe, expect, it } from "vitest";
import { FORMS, FORM_IDS } from "@/lib/forms/definitions";
import { parseSubmission } from "@/lib/forms/schema";

describe.each(FORM_IDS)("the %s form", (id) => {
  const form = FORMS[id];

  it("has three samples: clear, overlapping and little context", () => {
    expect(form.samples.map((s) => s.kind)).toEqual(["clear", "overlap", "sparse"]);
  });

  it("has unique teams, one of them its triage team", () => {
    const ids = form.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(form.triageTeam);
  });

  it("accepts each of its samples", () => {
    for (const sample of form.samples) {
      expect(Object.keys(sample.values).sort()).toEqual(form.fields.map((f) => f.name).sort());
      const parsed = parseSubmission(form, sample.values);
      expect(parsed.ok, `${sample.kind}: ${JSON.stringify(parsed)}`).toBe(true);
    }
  });

  it("rejects a missing required field", () => {
    for (const field of form.fields.filter((f) => f.required)) {
      const parsed = parseSubmission(form, { ...form.samples[0].values, [field.name]: "  " });
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors[field.name]).toBe("This field is required.");
    }
  });

  it("rejects a field over its length", () => {
    const field = form.fields.find((f) => f.kind === "textarea")!;
    const parsed = parseSubmission(form, { ...form.samples[0].values, [field.name]: "x".repeat(field.maxLength + 1) });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[field.name]).toMatch(/at most/);
  });

  it("rejects an address that is not an email", () => {
    const parsed = parseSubmission(form, { ...form.samples[0].values, email: "not an email" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.email).toMatch(/Enter an email address/);
  });

  it("rejects a value outside a select's options", () => {
    const field = form.fields.find((f) => f.kind === "select");
    if (!field) return;
    const parsed = parseSubmission(form, { ...form.samples[0].values, [field.name]: "Something else" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[field.name]).toMatch(/listed options/);
  });

  it("rejects fields the form does not define", () => {
    const parsed = parseSubmission(form, { ...form.samples[0].values, admin: "true" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors._form).toBeDefined();
  });

  it("trims values and reads a left-out optional field as empty", () => {
    const values: Record<string, string> = { ...form.samples[0].values, name: "  Robin  " };
    const optional = form.fields.find((f) => !f.required)!;
    delete values[optional.name];
    const parsed = parseSubmission(form, values);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.submission.name).toBe("Robin");
      expect(parsed.submission[optional.name]).toBe("");
    }
  });
});
