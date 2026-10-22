import { render, toPlainText } from "@react-email/render";
import type { FormDef, Submission } from "../forms/types";
import { MODEL_NAMES } from "../router/config";
import type { QuestionResult, RoutingResult } from "../router/types";

export interface EmailMessage {
  subject: string;
  /** The team's inbox, or `null` when none is set. */
  to: string | null;
  /** The submitter's address, so a reply goes to them. */
  replyTo: string;
  html: string;
  text: string;
}

const font = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const cell = { padding: "6px 0", verticalAlign: "top" as const, fontSize: "14px", lineHeight: "20px" };

function settledBy(q: QuestionResult): string {
  return q.settledBy === "safe" ? "safe action" : MODEL_NAMES[q.settledBy];
}

export function urgencyLabel(result: RoutingResult): string {
  const u = result.questions.urgency.final;
  return u.kind === "urgency" ? u.label : "Unsure";
}

export function spamLabel(result: RoutingResult): string {
  const s = result.questions.spam.final;
  if (s.kind !== "spam") return "Not checked";
  if (s.review) return "Unsure, review it";
  return s.spam ? "Spam" : "Not spam";
}

function headline(form: FormDef, submission: Submission): string {
  const text = submission.subject || submission.message || submission.description || "New submission";
  const line = text.split("\n")[0].trim();
  return line.length > 72 ? `${line.slice(0, 71).trimEnd()}...` : line;
}

export function RoutedSubmission({ form, submission, result }: { form: FormDef; submission: Submission; result: RoutingResult }) {
  const rows: [string, string][] = [
    ["Team", result.destination.teamName],
    ["Urgency", urgencyLabel(result)],
    ["Spam check", spamLabel(result)],
  ];
  return (
    <html lang="en">
      {/* an email document, not a Next.js page */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width" />
      </head>
      <body style={{ margin: 0, padding: "24px 12px", background: "#f4f5f2", fontFamily: font, color: "#0a0b09" }}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: "560px", margin: "0 auto" }}>
          <tbody>
            <tr>
              <td style={{ background: "#ffffff", borderRadius: "12px", padding: "28px", border: "1px solid #e3e5df" }}>
                <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#4b5057" }}>{form.title}</p>
                <h1 style={{ margin: "0 0 20px", fontSize: "20px", lineHeight: "28px", fontWeight: 600 }}>
                  {headline(form, submission)}
                </h1>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {rows.map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...cell, width: "130px", color: "#4b5057" }}>{label}</td>
                        <td style={{ ...cell, fontWeight: 600 }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr style={{ border: "none", borderTop: "1px solid #e3e5df", margin: "20px 0" }} />
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {form.fields.map((field) => (
                      <tr key={field.name}>
                        <td style={{ ...cell, width: "130px", color: "#4b5057" }}>{field.label}</td>
                        <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{submission[field.name] || "Not given"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr style={{ border: "none", borderTop: "1px solid #e3e5df", margin: "20px 0" }} />
                <p style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: "#4b5057" }}>
                  Routed by the DecisionNode form router. Team: {settledBy(result.questions.destination)}. Urgency:{" "}
                  {settledBy(result.questions.urgency)}. Spam check: {settledBy(result.questions.spam)}. Reply to this
                  email to answer {submission.name || "the sender"}.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

/** The routed submission as an email, in HTML and plain text. */
export async function buildEmail(
  form: FormDef,
  submission: Submission,
  result: RoutingResult,
  to: string | null,
): Promise<EmailMessage> {
  const html = await render(<RoutedSubmission form={form} submission={submission} result={result} />);
  return {
    subject: `[${urgencyLabel(result)}] ${form.title}: ${headline(form, submission)}`,
    to,
    replyTo: submission.email,
    html,
    text: toPlainText(html),
  };
}
