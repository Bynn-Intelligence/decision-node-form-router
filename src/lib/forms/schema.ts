import { z } from "zod";
import type { FieldDef, FormDef, Submission } from "./types";

function fieldSchema(field: FieldDef) {
  let text = z.string().trim().max(field.maxLength, `${field.label} is at most ${field.maxLength} characters.`);
  if (field.required) text = text.min(1, `${field.label} is required.`);

  if (field.kind === "email") {
    const address = z.email(`${field.label} must be an email address.`).max(field.maxLength);
    return field.required ? text.pipe(address) : text.pipe(z.union([z.literal(""), address]));
  }
  if (field.kind === "select" && field.options) {
    const allowed = field.required ? field.options : ["", ...field.options];
    return text.refine((v) => allowed.includes(v), `${field.label} must be one of the listed options.`);
  }
  return text;
}

/** The zod schema of a form's submission, built from its field definitions. */
export function submissionSchema(form: FormDef) {
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of form.fields) shape[field.name] = fieldSchema(field);
  return z.object(shape).strict();
}

export type FieldErrors = Record<string, string>;

export type ParseResult = { ok: true; submission: Submission } | { ok: false; errors: FieldErrors };

/**
 * Validates raw values against the form. A field left out reads as empty, and
 * keys the form does not define are rejected.
 */
export function parseSubmission(form: FormDef, raw: Record<string, unknown>): ParseResult {
  const values: Record<string, unknown> = {};
  for (const field of form.fields) values[field.name] = raw[field.name] ?? "";
  for (const key of Object.keys(raw)) if (!(key in values)) values[key] = raw[key];

  const parsed = submissionSchema(form).safeParse(values);
  if (parsed.success) return { ok: true, submission: parsed.data as Submission };

  const errors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    const known = form.fields.some((f) => f.name === key);
    const target = known ? key : "_form";
    errors[target] ??= known ? issue.message : "The submission has fields this form does not define.";
  }
  return { ok: false, errors };
}
