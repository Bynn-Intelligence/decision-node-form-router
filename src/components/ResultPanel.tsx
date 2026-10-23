"use client";

import { ArrowClockwise, ArrowsSplit, BookOpenText, Lightning, Prohibit, ShieldCheck, Warning, type Icon } from "@phosphor-icons/react";
import { MODEL_SHORT, describeModels, formatConfidence, formatMs } from "@/lib/format";
import type { FormDef } from "@/lib/forms/types";
import { questionsFor } from "@/lib/router/questions";
import type { SubmitState } from "@/lib/submit";
import { CallList, EmailSection, KIND_ICONS, QuestionCard } from "./ResultParts";
import type { RouterSettings } from "./settings";

interface ResultPanelProps {
  form: FormDef;
  state: SubmitState;
  pending: boolean;
  formDomId: string;
  settings: RouterSettings;
}

export function ResultPanel({ form, state, pending, formDomId, settings }: ResultPanelProps) {
  return (
    <section
      aria-labelledby="result-title"
      aria-busy={pending}
      className="rounded-2xl border border-line bg-panel p-5 sm:p-6 lg:sticky lg:top-6"
    >
      <h2 id="result-title" className="sr-only">
        Routing result
      </h2>
      <div aria-live="polite">
        {pending ? (
          <Loading />
        ) : state.status === "result" ? (
          <Result state={state} />
        ) : state.status === "error" ? (
          <Failure state={state} formDomId={formDomId} />
        ) : (
          <Idle form={form} settings={settings} invalid={state.status === "invalid"} />
        )}
      </div>
    </section>
  );
}

function RulesStatus({ on }: { on: boolean }) {
  return on ? (
    <div className="flex items-start gap-3 rounded-xl border border-lime/40 p-4">
      <BookOpenText size={22} weight="light" className="mt-0.5 shrink-0 text-lime" aria-hidden />
      <div className="text-sm leading-relaxed">
        <p className="font-medium">Routing by your rules</p>
        <p className="mt-0.5 text-muted">
          Every request reads this form&apos;s playbook from your knowledge base, and the result shows the passages each answer
          rested on.
        </p>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-3 rounded-xl border border-amber/40 p-4">
      <BookOpenText size={22} weight="light" className="mt-0.5 shrink-0 text-amber" aria-hidden />
      <div className="text-sm leading-relaxed">
        <p className="font-medium">No routing rules loaded</p>
        <p className="mt-0.5 text-muted">
          The router decides from the team names and criteria alone. Load the playbooks with{" "}
          <code className="font-mono text-text">pnpm knowledge:setup</code> to route by the company&apos;s own rules.
        </p>
      </div>
    </div>
  );
}

function Idle({ form, settings, invalid }: { form: FormDef; settings: RouterSettings; invalid: boolean }) {
  const threshold = formatConfidence(settings.threshold);
  const asked = questionsFor(form, true);
  const steps =
    settings.models.length === 2
      ? [
          { icon: Lightning, text: "Flash answers every question." },
          { icon: ArrowsSplit, text: `Each answer below ${threshold} confidence goes on to DecisionNode, alone.` },
          { icon: ShieldCheck, text: "Still below it, the question takes its safe action." },
        ]
      : [
          { icon: settings.models[0] === "moe" ? ArrowsSplit : Lightning, text: `${describeModels(settings.models).replace(" only", "")} answers every question.` },
          { icon: ShieldCheck, text: `Below ${threshold} confidence, the question takes its safe action.` },
        ];

  return (
    <div>
      {invalid ? (
        <p className="flex items-center gap-2 text-sm text-coral">
          <Warning size={18} weight="light" aria-hidden />
          Fix the highlighted fields, then route again.
        </p>
      ) : (
        <p className="text-sm text-muted">Nothing routed yet. Pick a sample or write your own, then route it.</p>
      )}
      <div className="mt-5">
        <RulesStatus on={settings.knowledge} />
      </div>
      <h3 className="mt-6 font-medium">The questions</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {asked.map((q) => {
          const Icon = KIND_ICONS[q.kind];
          return (
            <li key={q.id} className="flex items-center gap-3 rounded-xl bg-raised px-4 py-3">
              <Icon size={20} weight="light" className="shrink-0 text-lime" aria-hidden />
              <span className="text-sm">
                {q.title}
                {q.flag?.withPictures && <span className="text-muted"> (with a picture)</span>}
              </span>
              <span className="ml-auto font-mono text-xs text-muted">
                {q.kind === "destination" ? "choice" : q.kind === "urgency" ? "score" : "truth"}
              </span>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-6 font-medium">{describeModels(settings.models)}</h3>
      <ol className="mt-3 space-y-3">
        {steps.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
            <Icon size={18} weight="light" className="mt-0.5 shrink-0 text-text" aria-hidden />
            {text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Loading() {
  return (
    <div>
      <p className="text-sm text-muted">Asking the models</p>
      <div className="mt-5 animate-pulse space-y-3" aria-hidden>
        <div className="h-24 rounded-xl bg-raised" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-raised" />
        ))}
      </div>
    </div>
  );
}

function Failure({ state, formDomId }: { state: Extract<SubmitState, { status: "error" }>; formDomId: string }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Warning size={24} weight="light" className="mt-0.5 shrink-0 text-coral" aria-hidden />
        <div>
          <p className="font-medium">The submission was not routed</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{state.message} No email was sent.</p>
        </div>
      </div>
      {state.retryable && (
        <button
          type="submit"
          form={formDomId}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-control px-4 py-2 text-sm font-medium transition-[border-color,transform] duration-200 ease-out-soft hover:border-lime active:scale-[0.98]"
        >
          <ArrowClockwise size={16} weight="light" aria-hidden />
          Try again
        </button>
      )}
      {state.calls.length > 0 && <CallList calls={state.calls} />}
    </div>
  );
}

function Result({ state }: { state: Extract<SubmitState, { status: "result" }> }) {
  const { result } = state;
  const { outcome } = result;
  const flashRan = result.models.includes("flash");
  const elapsed = result.calls.reduce((sum, c) => sum + c.elapsedMs, 0);
  const passages = new Set(result.calls.flatMap((c) => c.knowledge?.passages.map((p) => `${p.reference}:${p.n}`) ?? [])).size;
  const safe = result.questions.filter((q) => q.settledBy === "safe");

  return (
    <div>
      <div className="rounded-xl bg-raised p-5">
        <p className="text-sm text-muted">{outcome.deliver ? "Goes to" : "Held, meant for"}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{outcome.queue}</p>
        {outcome.queue !== outcome.teamName && <p className="mt-1 text-sm text-muted">{outcome.teamName}</p>}
        {outcome.nextStep && (
          <p className="mt-3 inline-flex rounded-full border border-amber/50 px-3 py-1 text-sm text-amber">
            Next step: {outcome.nextStep}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {flashRan && (
            <span className="inline-flex items-center gap-1.5">
              <Lightning size={16} weight="light" className="text-lime" aria-hidden />
              {result.settledByFlash} of {result.questions.length} settled by Flash
            </span>
          )}
          <span className="text-muted">
            {result.calls.length} {result.calls.length === 1 ? "call" : "calls"}, {formatMs(elapsed)}
          </span>
          <span className="text-muted">Threshold {formatConfidence(result.threshold)}</span>
        </div>
        <p className="mt-3 inline-flex items-center gap-2 text-sm">
          <BookOpenText size={16} weight="light" className={result.knowledge ? "text-lime" : "text-amber"} aria-hidden />
          {result.knowledge ? (
            <span>
              Routed by your rules: {passages} {passages === 1 ? "passage" : "passages"} read
            </span>
          ) : (
            <span className="text-muted">
              No routing rules were used. Run <code className="font-mono text-text">pnpm knowledge:setup</code> to add them.
            </span>
          )}
        </p>
      </div>

      {result.unavailable && <UnavailableNotice result={result} />}
      {!outcome.deliver && (
        <Notice icon={Prohibit} title="Held">
          A check was sure this should not be delivered, so it is shown here and not sent on.
        </Notice>
      )}
      {(outcome.notes.length > 0 || safe.some((q) => q.kind !== "flag")) && (
        <Notice icon={ShieldCheck} title={outcome.review || safe.length > 0 ? "For a person to review" : "Checks"}>
          {[
            ...safe.filter((q) => q.kind !== "flag").map((q) => q.safeAction),
            ...outcome.notes,
          ].join(" ")}
        </Notice>
      )}

      <div className="mt-5 space-y-3">
        {result.questions.map((q) => (
          <QuestionCard key={q.id} question={q} calls={result.calls} threshold={result.threshold} />
        ))}
      </div>

      <CallList calls={result.calls} />
      <EmailSection email={state.email} />
    </div>
  );
}

function UnavailableNotice({ result }: { result: Extract<SubmitState, { status: "result" }>["result"] }) {
  const kept = result.questions.filter((q) => q.kept);
  const safe = result.questions.filter((q) => q.unanswered && !q.kept);
  const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
  const parts = ["The answers that met the threshold stand."];
  if (kept.length > 0) {
    const by = MODEL_SHORT[kept[0].settledBy as keyof typeof MODEL_SHORT];
    parts.push(`${count(kept.length, "One question keeps", "questions keep")} ${by}'s answer, below the threshold.`);
  }
  if (safe.length > 0) parts.push(`${count(safe.length, "One question no model answered", "questions no model answered")} took the safe action.`);
  parts.push("The submission was routed.");
  return (
    <Notice icon={Warning} title={result.unavailable!}>
      {parts.join(" ")}
    </Notice>
  );
}

function Notice({ icon: Icon, title, children }: { icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber/40 p-4">
      <Icon size={20} weight="light" className="mt-0.5 shrink-0 text-amber" aria-hidden />
      <div className="text-sm leading-relaxed">
        <p className="font-medium text-amber">{title}</p>
        <p className="mt-0.5 text-muted">{children}</p>
      </div>
    </div>
  );
}
