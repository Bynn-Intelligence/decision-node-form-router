"use client";

import { ImageSquare, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FieldDef } from "@/lib/forms/types";
import { preparePicture } from "./pictures";

interface PictureFieldProps {
  field: FieldDef;
  files: File[];
  error?: string;
  onFiles: (files: File[]) => void;
}

/** A picture field: choose files, see each one, remove one or all. The files are sent with the form by the parent. */
export function PictureField({ field, files, error, onFiles }: PictureFieldProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const most = field.maxPictures ?? 4;
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    const prepared = await Promise.all([...list].map(preparePicture));
    setBusy(false);
    onFiles((most === 1 ? prepared : [...files, ...prepared]).slice(0, most));
    if (input.current) input.current.value = "";
  }

  const full = files.length >= most && most > 1;
  const describedBy = [field.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
          {!field.required && <span className="font-normal text-muted"> (optional)</span>}
        </label>
        {files.length > 1 && (
          <button
            type="button"
            onClick={() => onFiles([])}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted transition-colors duration-200 hover:text-text"
          >
            <Trash size={14} weight="light" aria-hidden />
            Remove all
          </button>
        )}
      </div>
      {field.hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {field.hint}
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="group relative overflow-hidden rounded-lg border border-line bg-page">
              {/* a local object URL, so next/image does not apply */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={file.name} className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                onClick={() => onFiles(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-page/85 text-text transition-colors duration-200 hover:bg-page"
              >
                <X size={14} weight="light" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label
          htmlFor={id}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors duration-200 hover:border-lime has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime ${
            error ? "border-coral" : "border-control"
          }`}
        >
          {busy ? (
            <ImageSquare size={20} weight="light" className="text-muted" aria-hidden />
          ) : (
            <UploadSimple size={20} weight="light" className="text-lime" aria-hidden />
          )}
          <span>
            {busy
              ? "Preparing..."
              : files.length === 0
                ? most === 1
                  ? "Choose a picture"
                  : "Choose pictures"
                : most === 1
                  ? "Replace the picture"
                  : "Add another"}
          </span>
          <input
            ref={input}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={most > 1}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => add(e.target.files)}
            className="sr-only"
          />
        </label>
      )}

      {error && (
        <p id={`${id}-error`} className="text-sm text-coral">
          {error}
        </p>
      )}
    </div>
  );
}
