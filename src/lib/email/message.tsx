import { render, toPlainText } from "@react-email/render";
import { textFields } from "../forms/schema";
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
  /** The pictures' file names; the pictures go as attachments. */
  attachments: string[];
}

const font = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const cell = { padding: "6px 0", verticalAlign: "top" as const, fontSize: "14px", lineHeight: "20px" };
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

function settledBy(q: QuestionResult): string {
  return q.settledBy === "safe" ? "safe action" : MODEL_NAMES[q.settledBy];
}

/** One question's final answer in words. */
export function answerLabel(q: QuestionResult): string {
  const f = q.final;
  if (f.kind === "destination") return f.teamName;
  if (f.kind === "urgency") return f.label;
  return f.value === null ? "Unsure, review it" : f.label;
}

export function urgencyLabel(result: RoutingResult): string | null {
  const u = result.questions.find((q) => q.kind === "urgency");
  return u ? answerLabel(u) : null;
}

/** The submission's subject line, its first line, without control characters, at most 72 characters. */
function headline(submission: Submission): string {
  const v = submission.values;
  const text = v.subject || v.message || v.description || v.problem || v.reason || v.report || `Submission from ${v.name || v.full_name || "a visitor"}`;
  const line = text.split(/\r?\n/)[0].replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return line.length > 72 ? `${line.slice(0, 71).trimEnd()}...` : line;
}

export function pictureFileName(p: Submission["pictures"][number]): string {
  return `${p.id}.${EXTENSIONS[p.mediaType]}`;
}

export function RoutedSubmission({ form, submission, result }: { form: FormDef; submission: Submission; result: RoutingResult }) {
  const { outcome } = result;
  const rows: [string, string][] = [["Goes to", outcome.queue]];
  if (outcome.nextStep) rows.push(["Next step", outcome.nextStep]);
  for (const q of result.questions) rows.push([q.title, answerLabel(q)]);
  const name = submission.values.name || submission.values.full_name || "the sender";

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
                <h1 style={{ margin: "0 0 20px", fontSize: "20px", lineHeight: "28px", fontWeight: 600 }}>{headline(submission)}</h1>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {rows.map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...cell, width: "150px", color: "#4b5057" }}>{label}</td>
                        <td style={{ ...cell, fontWeight: 600 }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(outcome.notes.length > 0 || result.unavailable) && (
                  <p style={{ margin: "16px 0 0", fontSize: "14px", lineHeight: "20px", color: "#7a4b00" }}>
                    {[result.unavailable ? `${result.unavailable}.` : null, ...outcome.notes].filter(Boolean).join(" ")}
                  </p>
                )}
                <hr style={{ border: "none", borderTop: "1px solid #e3e5df", margin: "20px 0" }} />
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                  <tbody>
                    {textFields(form).map((field) => (
                      <tr key={field.name}>
                        <td style={{ ...cell, width: "150px", color: "#4b5057" }}>{field.label}</td>
                        <td style={{ ...cell, whiteSpace: "pre-wrap" }}>{submission.values[field.name] || "Not given"}</td>
                      </tr>
                    ))}
                    {submission.pictures.length > 0 && (
                      <tr>
                        <td style={{ ...cell, width: "150px", color: "#4b5057" }}>Pictures</td>
                        <td style={cell}>{submission.pictures.map(pictureFileName).join(", ")}, attached</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <hr style={{ border: "none", borderTop: "1px solid #e3e5df", margin: "20px 0" }} />
                <p style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: "#4b5057" }}>
                  Routed by the DecisionNode form router
                  {result.knowledge ? ", following your routing rules" : ""}.{" "}
                  {result.questions.map((q) => `${q.title}: ${settledBy(q)}.`).join(" ")} Reply to this email to answer {name}.
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
  const urgency = urgencyLabel(result);
  return {
    subject: `${urgency ? `[${urgency}] ` : ""}${form.title}: ${headline(submission)}`,
    to,
    replyTo: submission.values.email,
    html,
    text: toPlainText(html),
    attachments: submission.pictures.map(pictureFileName),
  };
}
