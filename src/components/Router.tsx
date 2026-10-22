"use client";

import { Briefcase, Bug, ChatCircleText, type Icon } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { FORMS, FORM_IDS, type FormId } from "@/lib/forms/definitions";
import type { ModelKey } from "@/lib/router/config";
import { Workspace } from "./Workspace";

const FORM_ICONS: Record<FormId, Icon> = { sales: Briefcase, support: ChatCircleText, bugs: Bug };

export interface RouterSettings {
  models: ModelKey[];
  threshold: number;
  emailOn: boolean;
}

type Values = Record<FormId, Record<string, string>>;

function initialValues(): Values {
  const values = {} as Values;
  for (const id of FORM_IDS) values[id] = { ...FORMS[id].samples[0].values };
  return values;
}

/** The form tabs. Each form keeps its own values while another is shown. */
export function Router({ settings }: { settings: RouterSettings }) {
  const [active, setActive] = useState<FormId>("sales");
  const [values, setValues] = useState<Values>(initialValues);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = FORM_IDS[(FORM_IDS.indexOf(active) + step + FORM_IDS.length) % FORM_IDS.length];
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Forms"
        onKeyDown={onKeyDown}
        className="grid w-full grid-cols-3 gap-1 rounded-full border border-line bg-panel p-1 sm:inline-flex sm:w-auto"
      >
        {FORM_IDS.map((id) => {
          const Icon = FORM_ICONS[id];
          const selected = id === active;
          return (
            <button
              key={id}
              ref={(el) => {
                tabs.current[id] = el;
              }}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(id)}
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3 py-2 sm:px-4 text-sm font-medium transition-colors duration-200 ${
                selected ? "bg-lime text-ink" : "text-muted hover:text-text"
              }`}
            >
              <Icon size={18} weight="light" aria-hidden />
              <span className="sm:hidden">{FORMS[id].shortTitle}</span>
              <span className="max-sm:hidden">{FORMS[id].title}</span>
            </button>
          );
        })}
      </div>

      <div id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`} className="mt-6">
        <Workspace
          key={active}
          formId={active}
          values={values[active]}
          onValues={(next) => setValues((all) => ({ ...all, [active]: next }))}
          settings={settings}
        />
      </div>
    </div>
  );
}
