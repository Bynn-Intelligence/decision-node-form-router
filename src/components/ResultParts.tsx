"use client";

import { CaretDown, CheckCircle, Eye, Prohibit, Warning } from "@phosphor-icons/react";
import type { EmailOutcome } from "@/lib/email/deliver";
import { MODEL_SHORT, formatCallCost, formatConfidence, formatMs, formatUsd, totalCost, totalTokens } from "@/lib/format";
import type { AnswerView, Attempt, CallRecord, FinalAnswer, QuestionResult } from "@/lib/router/types";
import { QUESTION_META } from "./questionMeta";

function answerText(a: AnswerView): string {
  switch (a.kind) {
    case "destination":
      return a.teamName;
    case "destination_unregistered":
      return `"${a.value}", not one of the teams`;
    case "urgency":
      return `${a.label}, score ${a.score.toFixed(2)}`;
    case "spam":
      return `${a.spam ? "Spam" : "Not spam"}, p ${a.probability.toFixed(2)}`;
    default:
      return "No answer";
  }
}

function finalText(f: FinalAnswer): string {
  if (f.kind === "destination") return f.teamName;
  if (f.kind === "urgency") return f.label;
  if (f.review) return "Not spam, review";
  return f.spam ? "Spam" : "Not spam";
}

function SettledChip({ by }: { by: QuestionResult["settledBy"] }) {
  const style =
    by === "flash" ? "border-lime/50 text-lime" : by === "moe" ? "border-white/40 text-text" : "border-amber/50 text-amber";
  const label = by === "safe" ? "Safe action" : `Settled by ${MODEL_SHORT[by]}`;
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

function Meter({ attempt, threshold }: { attempt: Attempt; threshold: number }) {
  const pct = Math.round(attempt.confidence * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="img"
        aria-label={`Confidence ${formatConfidence(attempt.confidence)}, threshold ${formatConfidence(threshold)}`}
        className="relative h-1.5 w-16 rounded-full bg-white/10"
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${attempt.sure ? "bg-lime" : "bg-amber"}`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute -inset-y-1 w-px bg-text" style={{ left: `${threshold * 100}%` }} />
      </span>
      <span className="font-mono text-xs tabular-nums">{formatConfidence(attempt.confidence)}</span>
    </span>
  );
}

export function QuestionCard({ question, calls, threshold }: { question: QuestionResult; calls: CallRecord[]; threshold: number }) {
  const { title, icon: Icon } = QUESTION_META[question.id];
  return (
    <article className="rounded-xl border border-line p-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Icon size={20} weight="light" className="text-lime" aria-hidden />
        <h3 className="text-sm text-muted">{title}</h3>
        <p className="font-medium">{finalText(question.final)}</p>
        <span className="ml-auto">
          <SettledChip by={question.settledBy} />
        </span>
      </header>

      {question.attempts.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {question.attempts.map((a) => (
            <li
              key={a.model}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)_auto_4.5rem]"
            >
              <span className="text-muted">{MODEL_SHORT[a.model]}</span>
              <span className="truncate" title={answerText(a.answer)}>
                {answerText(a.answer)}
              </span>
              <span className="col-start-2 sm:col-start-auto">
                <Meter attempt={a} threshold={threshold} />
              </span>
              <span className="col-start-2 font-mono text-xs text-muted tabular-nums sm:col-start-auto sm:text-right">
                {formatMs(calls[a.call].elapsedMs)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No model answered this question.</p>
      )}
    </article>
  );
}

export function CallList({ calls }: { calls: CallRecord[] }) {
  const total = totalCost(calls);
  const tokens = totalTokens(calls);
  return (
    <div className="mt-6">
      <h3 className="font-medium">Calls</h3>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
        {calls.map((call, i) => (
          <li key={i} className="grid gap-1 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
            <div className="min-w-0">
              <p className="font-medium">
                {MODEL_SHORT[call.model]}
                {call.version && <span className="ml-2 font-mono text-xs font-normal text-muted">{call.version}</span>}
              </p>
              <p className="mt-0.5 text-muted">
                Asked {call.questions.map((q) => QUESTION_META[q].title.toLowerCase()).join(", ")}
                {call.error && <span className="text-coral">. {call.error.message}</span>}
              </p>
            </div>
            <div className="font-mono text-xs leading-5 text-muted tabular-nums sm:text-right">
              <p>
                {formatMs(call.elapsedMs)}
                {call.serverMs !== null && ` round trip, ${formatMs(call.serverMs)} on the server`}
              </p>
              <p className="text-text">{formatCallCost(call)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        {total !== null
          ? `Total ${formatUsd(total)}, as the API reported it for each call.`
          : tokens
            ? `Total ${tokens}. The API sent no cost for every call, so the tokens are shown.`
            : "No call was billed."}
      </p>
    </div>
  );
}

const EMAIL_STATUS = {
  sent: { icon: CheckCircle, tone: "text-lime" },
  preview: { icon: Eye, tone: "text-text" },
  held: { icon: Prohibit, tone: "text-amber" },
  failed: { icon: Warning, tone: "text-coral" },
} as const;

export function EmailSection({ email }: { email: EmailOutcome }) {
  const { icon: Icon, tone } = EMAIL_STATUS[email.status];
  const { message } = email;
  return (
    <div className="mt-6">
      <h3 className="font-medium">Email</h3>
      <p className="mt-2 flex items-start gap-2 text-sm">
        <Icon size={18} weight="light" className={`mt-0.5 shrink-0 ${tone}`} aria-hidden />
        <span className="text-muted">
          {email.status === "sent" ? `Sent to ${message.to}.` : email.reason}
        </span>
      </p>
      <dl className="mt-3 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">To</dt>
        <dd className="truncate">{message.to ?? "No inbox set"}</dd>
        <dt className="text-muted">Reply to</dt>
        <dd className="truncate">{message.replyTo}</dd>
        <dt className="text-muted">Subject</dt>
        <dd>{message.subject}</dd>
      </dl>
      <details className="group mt-3 rounded-xl border border-line">
        <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium">
          Show the email
          <CaretDown size={16} weight="light" className="transition-transform duration-200 group-open:rotate-180" aria-hidden />
        </summary>
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={message.html}
          className="h-[28rem] w-full rounded-b-xl border-t border-line bg-white"
        />
      </details>
    </div>
  );
}
