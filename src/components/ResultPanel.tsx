"use client";

import { ArrowClockwise, ArrowsSplit, Lightning, Prohibit, ShieldCheck, Warning, type Icon } from "@phosphor-icons/react";
import { describeModels, formatConfidence, formatMs } from "@/lib/format";
import type { SubmitState } from "@/lib/submit";
import { QUESTION_META } from "./questionMeta";
import { CallList, EmailSection, QuestionCard } from "./ResultParts";
import type { RouterSettings } from "./Router";


interface ResultPanelProps {
  state: SubmitState;
  pending: boolean;
  formDomId: string;
  settings: RouterSettings;
}

export function ResultPanel({ state, pending, formDomId, settings }: ResultPanelProps) {
  return (
    <section aria-labelledby="result-title" aria-busy={pending} className="rounded-2xl border border-line bg-panel p-5 sm:p-6 lg:sticky lg:top-6">
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
          <Idle settings={settings} invalid={state.status === "invalid"} />
        )}
      </div>
    </section>
  );
}

function Idle({ settings, invalid }: { settings: RouterSettings; invalid: boolean }) {
  const threshold = formatConfidence(settings.threshold);
  const steps =
    settings.models.length === 2
      ? [
          { icon: Lightning, text: "Flash answers all three questions." },
          { icon: ArrowsSplit, text: `Each answer below ${threshold} confidence goes on to DecisionNode, alone.` },
          { icon: ShieldCheck, text: "Still below it, the question takes its safe action." },
        ]
      : settings.models[0] === "moe"
        ? [
            { icon: ArrowsSplit, text: "DecisionNode answers all three questions." },
            { icon: ShieldCheck, text: `Below ${threshold} confidence, the question takes its safe action.` },
          ]
        : [
            { icon: Lightning, text: "Flash answers all three questions." },
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
      <h3 className="mt-6 font-medium">Three questions per submission</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {Object.values(QUESTION_META).map(({ title, icon: Icon, type }) => (
          <li key={title} className="rounded-xl bg-raised p-4">
            <Icon size={22} weight="light" className="text-lime" aria-hidden />
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-0.5 font-mono text-xs text-muted">{type}</p>
          </li>
        ))}
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
      <p className="flex items-center gap-2 text-sm text-muted">Asking the models</p>
      <div className="mt-5 animate-pulse space-y-3" aria-hidden>
        <div className="h-20 rounded-xl bg-raised" />
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
  const spam = result.questions.spam.final;
  const safe = (["destination", "urgency", "spam"] as const).filter((id) => result.questions[id].settledBy === "safe");
  const flashRan = result.models.includes("flash");
  const elapsed = result.calls.reduce((sum, c) => sum + c.elapsedMs, 0);

  return (
    <div>
      <div className="rounded-xl bg-raised p-5">
        <p className="text-sm text-muted">{result.deliver ? "Routed to" : "Held as spam, meant for"}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{result.destination.teamName}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {flashRan && (
            <span className="inline-flex items-center gap-1.5">
              <Lightning size={16} weight="light" className="text-lime" aria-hidden />
              {result.settledByFlash} of 3 settled by Flash
            </span>
          )}
          <span className="text-muted">
            {result.calls.length} {result.calls.length === 1 ? "call" : "calls"}, {formatMs(elapsed)}
          </span>
          <span className="text-muted">Threshold {formatConfidence(result.threshold)}</span>
        </div>
      </div>

      {!result.deliver && spam.kind === "spam" && (
        <Notice icon={Prohibit} title="Held as spam">
          The spam check was sure, so the submission is held and not delivered.
        </Notice>
      )}
      {safe.length > 0 && (
        <Notice icon={ShieldCheck} title="Safe action taken">
          No model reached {formatConfidence(result.threshold)} on{" "}
          {safe.map((id) => QUESTION_META[id].title.toLowerCase()).join(" and ")}.{" "}
          {safe.includes("destination") && `The submission goes to ${result.destination.teamName}. `}
          {safe.includes("urgency") && "Urgency is shown as unsure. "}
          {safe.includes("spam") && "It is treated as not spam and marked for review."}
        </Notice>
      )}

      <div className="mt-5 space-y-3">
        {(["destination", "urgency", "spam"] as const).map((id) => (
          <QuestionCard key={id} question={result.questions[id]} calls={result.calls} threshold={result.threshold} />
        ))}
      </div>

      <CallList calls={result.calls} />
      <EmailSection email={state.email} />
    </div>
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
