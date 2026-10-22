"use client";

import { ArrowRight, CircleNotch, Info } from "@phosphor-icons/react";
import { useActionState, useEffect, useState } from "react";
import { routeSubmission } from "@/app/actions";
import { FORMS, type FormId } from "@/lib/forms/definitions";
import type { FieldDef, FormDef, SampleDef } from "@/lib/forms/types";
import type { SubmitState } from "@/lib/submit";
import { PictureField } from "./PictureField";
import { samplePicture } from "./pictures";
import { ResultPanel } from "./ResultPanel";
import type { RouterSettings } from "./settings";

const IDLE: SubmitState = { status: "idle" };

const control =
  "w-full rounded-lg border border-control bg-page px-3 py-2.5 text-[15px] text-text transition-colors duration-200 hover:border-muted aria-[invalid=true]:border-coral";

type Files = Record<string, File[]>;

async function sampleFiles(sample: SampleDef): Promise<Files> {
  const out: Files = {};
  for (const [field, paths] of Object.entries(sample.pictures ?? {})) {
    out[field] = await Promise.all(paths.map(samplePicture));
  }
  return out;
}

/** One form and the result of its last submit. */
export function Workspace({ formId, settings }: { formId: FormId; settings: RouterSettings }) {
  const form: FormDef = FORMS[formId];
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...form.samples[0].values }));
  const [files, setFiles] = useState<Files>({});
  const [state, formAction, pending] = useActionState(routeSubmission, IDLE);
  const errors = state.status === "invalid" ? state.errors : {};
  const formDomId = `form-${formId}`;

  async function loadSample(sample: SampleDef) {
    setValues({ ...sample.values });
    setFiles({});
    try {
      setFiles(await sampleFiles(sample));
    } catch {
      // a missing sample picture leaves the field empty to fill by hand
    }
  }

  useEffect(() => {
    let live = true;
    sampleFiles(form.samples[0])
      .then((f) => live && setFiles(f))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [form]);

  function send(formData: FormData) {
    for (const field of form.fields) {
      if (field.kind !== "pictures") continue;
      formData.delete(field.name);
      for (const file of files[field.name] ?? []) formData.append(field.name, file);
    }
    formAction(formData);
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <form
        id={formDomId}
        action={send}
        noValidate
        aria-describedby={`${formDomId}-summary`}
        className="rounded-2xl border border-line bg-panel p-5 sm:p-6"
      >
        <input type="hidden" name="form_id" value={formId} />
        <h2 className="text-lg font-semibold tracking-tight">{form.title}</h2>
        <p id={`${formDomId}-summary`} className="mt-1 text-sm text-muted">
          {form.summary} Every field can be edited.
        </p>
        {form.notice && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-raised px-3 py-2.5 text-sm leading-relaxed text-muted">
            <Info size={18} weight="light" className="mt-0.5 shrink-0 text-text" aria-hidden />
            {form.notice}
          </p>
        )}

        <fieldset className="mt-5">
          <legend className="text-sm text-muted">Fill with a sample</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.samples.map((sample) => (
              <button
                key={sample.kind}
                type="button"
                onClick={() => loadSample(sample)}
                className="rounded-full border border-control px-3 py-1.5 text-sm text-text transition-[border-color,transform] duration-200 ease-out-soft hover:border-lime active:scale-[0.98]"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 space-y-5">
          {form.fields.map((field) =>
            field.kind === "pictures" ? (
              <PictureField
                key={field.name}
                field={field}
                files={files[field.name] ?? []}
                error={errors[field.name]}
                onFiles={(next) => setFiles((all) => ({ ...all, [field.name]: next }))}
              />
            ) : (
              <Field
                key={field.name}
                formId={formId}
                field={field}
                value={values[field.name] ?? ""}
                error={errors[field.name]}
                onChange={(v) => setValues((all) => ({ ...all, [field.name]: v }))}
              />
            ),
          )}
        </div>

        {errors._form && (
          <p role="alert" className="mt-4 text-sm text-coral">
            {errors._form}
          </p>
        )}

        {settings.emailOn ? (
          <label className="mt-6 flex items-start gap-3 text-sm">
            <input type="checkbox" name="send_email" className="mt-0.5 size-4 accent-lime" />
            <span>
              Email the routed submission to the team
              <span className="mt-0.5 block text-muted">Only teams with an inbox in src/lib/email/inboxes.ts get one.</span>
            </span>
          </label>
        ) : (
          <p className="mt-6 text-sm text-muted">Email is off. The result shows the email the team would get.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 font-medium text-ink transition-[transform,opacity] duration-200 ease-out-soft hover:bg-lime-soft active:scale-[0.98] disabled:opacity-80 sm:w-auto"
        >
          {pending ? (
            <>
              <CircleNotch size={18} weight="light" className="animate-spin" aria-hidden />
              Routing
            </>
          ) : (
            <>
              Route submission
              <ArrowRight size={18} weight="light" aria-hidden />
            </>
          )}
        </button>
      </form>

      <ResultPanel form={form} state={state} pending={pending} formDomId={formDomId} settings={settings} />
    </div>
  );
}

function Field({
  formId,
  field,
  value,
  error,
  onChange,
}: {
  formId: FormId;
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = `${formId}-${field.name}`;
  const errorId = `${id}-error`;
  const common = {
    id,
    name: field.name,
    value,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
    className: control,
  };

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {!field.required && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {field.kind === "textarea" ? (
        <textarea {...common} rows={field.rows ?? 4} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : field.kind === "select" ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.required ? "Choose one" : "Not given"}</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.kind === "email" ? "email" : "text"}
          autoComplete={field.kind === "email" ? "email" : field.name === "name" || field.name === "full_name" ? "name" : "off"}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <p id={errorId} className="text-sm text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
