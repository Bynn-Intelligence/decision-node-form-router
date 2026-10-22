import type { FormDef, Submission } from "../forms/types";
import type { RoutingResult } from "../router/types";
import { buildEmail, type EmailMessage } from "./message";

export interface EmailSettings {
  apiKey: string;
  from: string;
}

/** Resend's key and sender address, or `null` when either is missing. */
export function readEmailSettings(env: Record<string, string | undefined>): EmailSettings | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

/** Sends one email; throws when it was not accepted. */
export interface Sender {
  send(message: EmailMessage & { from: string; to: string }): Promise<{ id: string }>;
}

export type EmailOutcome =
  | { status: "sent"; id: string; message: EmailMessage }
  | { status: "preview"; reason: string; message: EmailMessage }
  | { status: "held"; reason: string; message: EmailMessage }
  | { status: "failed"; reason: string; message: EmailMessage };

export interface DeliverInput {
  form: FormDef;
  submission: Submission;
  result: RoutingResult;
  /** The submitter ticked the box to send the email. */
  optIn: boolean;
  settings: EmailSettings | null;
  /** The destination team's inbox, or `null`. */
  inbox: string | null;
  sender: Sender | null;
}

/**
 * Sends the routed submission to the team's inbox when every part is in place
 * and the submitter asked for it; otherwise returns the email as a preview. A
 * failed send is reported, never thrown: the routing result stands.
 */
export async function deliverEmail({ form, submission, result, optIn, settings, inbox, sender }: DeliverInput): Promise<EmailOutcome> {
  const message = await buildEmail(form, submission, result, inbox);

  if (!result.deliver) return { status: "held", reason: "Held as spam, so no email is sent.", message };
  if (!settings || !sender) {
    return { status: "preview", reason: "Email is off: set RESEND_API_KEY and RESEND_FROM to send it.", message };
  }
  if (!optIn) return { status: "preview", reason: "Not sent: the send box was not ticked.", message };
  if (!inbox) {
    return {
      status: "preview",
      reason: `Not sent: no inbox is set for ${result.destination.teamName} in src/lib/email/inboxes.ts.`,
      message,
    };
  }

  try {
    const { id } = await sender.send({ ...message, from: settings.from, to: inbox });
    return { status: "sent", id, message };
  } catch (err) {
    const detail = err instanceof Error && err.message ? `: ${err.message}` : "";
    return { status: "failed", reason: `The email could not be sent${detail}`, message };
  }
}
