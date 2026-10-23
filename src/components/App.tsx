"use client";

import { ArrowLeft, ArrowRight, Images } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { FORMS, FORM_IDS, INDUSTRIES, isFormId, type FormId } from "@/lib/forms/definitions";
import { FORM_ICONS } from "./formIcons";
import type { RouterSettings } from "./settings";
import { Workspace } from "./Workspace";

function formFromUrl(): FormId | null {
  const id = new URLSearchParams(window.location.search).get("form");
  return isFormId(id) ? id : null;
}

/** The form picker, grouped by industry, and the chosen form. The choice is kept in the address as `?form=<id>`. */
export function App({ initialForm, settings }: { initialForm: FormId | null; settings: RouterSettings }) {
  const [active, setActive] = useState<FormId | null>(initialForm);

  useEffect(() => {
    // the page decides where a form starts, not the browser's memory of the last scroll
    window.history.scrollRestoration = "manual";
    const onPop = () => {
      setActive(formFromUrl());
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function open(id: FormId | null) {
    window.history.pushState(null, "", id ? `?form=${id}` : window.location.pathname);
    setActive(id);
    // another form, or back to the picker, always starts at the top of the page
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (active) {
    const Icon = FORM_ICONS[active];
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => open(null)}
            className="inline-flex items-center gap-2 rounded-full border border-control px-3 py-1.5 text-sm transition-colors duration-200 hover:border-lime"
          >
            <ArrowLeft size={16} weight="light" aria-hidden />
            All forms
          </button>
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <Icon size={18} weight="light" className="text-lime" aria-hidden />
            {INDUSTRIES.find((i) => i.id === FORMS[active].industry)?.title}
          </span>
        </div>
        <Workspace key={active} formId={active} settings={settings} />
      </div>
    );
  }

  return (
    <nav aria-label="Forms" className="divide-y divide-line rounded-2xl border border-line bg-panel">
      {INDUSTRIES.map((industry) => {
        const forms = FORM_IDS.filter((id) => FORMS[id].industry === industry.id);
        if (forms.length === 0) return null;
        return (
          <section key={industry.id} className="grid gap-3 p-4 sm:p-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
            <h2 className="pt-1 text-sm text-muted">{industry.title}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {forms.map((id) => {
                const form = FORMS[id];
                const Icon = FORM_ICONS[id];
                const pictures = form.fields.find((f) => f.kind === "pictures");
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => open(id)}
                      className="group flex h-full w-full flex-col rounded-xl border border-line bg-raised p-4 text-left transition-[border-color,transform] duration-200 ease-out-soft hover:border-lime active:scale-[0.99]"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <Icon size={24} weight="light" className="text-lime" aria-hidden />
                        <ArrowRight
                          size={16}
                          weight="light"
                          className="text-muted transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5 group-hover:text-text"
                          aria-hidden
                        />
                      </span>
                      <span className="mt-3 font-medium">{form.title}</span>
                      <span className="mt-1 text-sm leading-relaxed text-muted">{form.summary}</span>
                      {pictures && (
                        <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                          <Images size={14} weight="light" aria-hidden />
                          {pictures.required ? "Pictures required" : "Pictures optional"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
