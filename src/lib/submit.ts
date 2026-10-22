import { getForm, isFormId, type FormId } from "./forms/definitions";
import { parseSubmission, type FieldErrors } from "./forms/schema";
import { deliverEmail, readEmailSettings, type EmailOutcome, type EmailSettings, type Sender } from "./email/deliver";
import { route, type Deciders } from "./router/cascade";
import { readConfig } from "./router/config";
import type { CallRecord, RoutingResult } from "./router/types";

/** What the page shows after a submit. Plain data: it is sent to the browser. */
export type SubmitState =
  | { status: "idle" }
  | { status: "invalid"; formId: FormId | null; errors: FieldErrors }
  | { status: "result"; formId: FormId; result: RoutingResult; email: EmailOutcome }
  | { status: "error"; formId: FormId | null; message: string; retryable: boolean; calls: CallRecord[] };

export interface SubmitDeps {
  env: Record<string, string | undefined>;
  makeDeciders: (apiKey: string) => Deciders;
  makeSender: (settings: EmailSettings) => Sender;
  inboxFor: (formId: FormId, teamId: string) => string | null;
}

/** Validates one submission, routes it, and sends or previews the email. */
export async function submit(formData: FormData, deps: SubmitDeps): Promise<SubmitState> {
  const formId = formData.get("form_id");
  if (!isFormId(formId)) {
    return { status: "error", formId: null, message: "Unknown form.", retryable: false, calls: [] };
  }

  const config = readConfig(deps.env);
  if (!config.ok) {
    const message =
      config.reason === "missing_key"
        ? "Set DECISIONNODE_API_KEY to route submissions."
        : `Fix the settings first: ${config.problems.join(" ")}`;
    return { status: "error", formId, message, retryable: false, calls: [] };
  }

  const form = getForm(formId);
  const raw: Record<string, unknown> = {};
  for (const field of form.fields) {
    const value = formData.get(field.name);
    raw[field.name] = typeof value === "string" ? value : "";
  }
  const parsed = parseSubmission(form, raw);
  if (!parsed.ok) return { status: "invalid", formId, errors: parsed.errors };

  const outcome = await route({
    form,
    submission: parsed.submission,
    config: config.config,
    clients: deps.makeDeciders(config.config.apiKey),
  });
  // no email is sent, or previewed, for a submission that was not routed
  if (!outcome.ok) return { status: "error", formId, ...outcome.error };

  const settings = readEmailSettings(deps.env);
  const email = await deliverEmail({
    form,
    submission: parsed.submission,
    result: outcome.result,
    optIn: formData.get("send_email") === "on",
    settings,
    inbox: deps.inboxFor(formId, outcome.result.destination.teamId),
    sender: settings ? deps.makeSender(settings) : null,
  });
  return { status: "result", formId, result: outcome.result, email };
}
