import { z } from "zod";
import type { FieldDef, FormDef } from "./types";

function fieldSchema(field: FieldDef) {
  const max = field.maxLength ?? 4000;
  let text = z.string().trim().max(max, `Use at most ${max.toLocaleString("en-US")} characters.`);
  if (field.required) text = text.min(1, "This field is required.");

  if (field.kind === "email") {
    const address = z.email("Enter an email address, like name@example.com.").max(max);
    return field.required ? text.pipe(address) : text.pipe(z.union([z.literal(""), address]));
  }
  if (field.kind === "select" && field.options) {
    const allowed = field.required ? field.options : ["", ...field.options];
    return text.refine((v) => allowed.includes(v), "Pick one of the listed options.");
  }
  return text;
}

export function textFields(form: FormDef): FieldDef[] {
  return form.fields.filter((f) => f.kind !== "pictures");
}

export function pictureFields(form: FormDef): FieldDef[] {
  return form.fields.filter((f) => f.kind === "pictures");
}

/** The zod schema of a form's text fields, built from its field definitions. */
export function submissionSchema(form: FormDef) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of textFields(form)) shape[field.name] = fieldSchema(field);
  return z.object(shape).strict();
}

export type FieldErrors = Record<string, string>;

export type ParseResult = { ok: true; values: Record<string, string> } | { ok: false; errors: FieldErrors };

/**
 * Validates the text fields against the form. A field left out reads as
 * empty, and keys the form does not define are rejected.
 */
export function parseValues(form: FormDef, raw: Record<string, unknown>): ParseResult {
  const values: Record<string, unknown> = {};
  const fields = textFields(form);
  for (const field of fields) values[field.name] = raw[field.name] ?? "";
  for (const key of Object.keys(raw)) if (!(key in values)) values[key] = raw[key];

  const parsed = submissionSchema(form).safeParse(values);
  if (parsed.success) return { ok: true, values: parsed.data as Record<string, string> };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    const known = fields.some((f) => f.name === key);
    const target = known ? key : "_form";
    errors[target] ??= known ? issue.message : "The submission has fields this form does not define.";
  }
  return { ok: false, errors };
}
