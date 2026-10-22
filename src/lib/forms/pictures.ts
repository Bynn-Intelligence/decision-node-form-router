import { pictureFields } from "./schema";
import type { FieldErrors } from "./schema";
import type { FormDef, Picture } from "./types";

export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PictureType = (typeof PICTURE_TYPES)[number];

/** Per picture, as the API takes it. */
export const MAX_PICTURE_BYTES = 5 * 1024 * 1024;
/** Per submission. */
export const MAX_PICTURES = 4;
/** All pictures of one submission together, so the request stays well under the API's body limit once in base64. */
export const MAX_TOTAL_PICTURE_BYTES = 16 * 1024 * 1024;

/** A file as it arrived, before it is checked. */
export interface RawPicture {
  name: string;
  bytes: Uint8Array;
}

/** The picture's type from its first bytes, whatever its name or stated type says. */
export function sniffPictureType(bytes: Uint8Array): PictureType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function megabytes(n: number): string {
  return `${Math.round(n / (1024 * 1024))} MB`;
}

export type PicturesResult = { ok: true; pictures: Picture[] } | { ok: false; errors: FieldErrors };

/**
 * Checks a submission's pictures, field by field: the count, each picture's
 * type (read from its bytes) and size, and the total. Gives each picture the
 * id the questions name it by: `screenshot_1`, `photo_2`, or the noun alone for
 * a field that takes one picture.
 */
export function checkPictures(form: FormDef, byField: Record<string, RawPicture[]>): PicturesResult {
  const errors: FieldErrors = {};
  const pictures: Picture[] = [];
  let total = 0;

  for (const field of pictureFields(form)) {
    const files = byField[field.name] ?? [];
    const most = Math.min(field.maxPictures ?? MAX_PICTURES, MAX_PICTURES);
    if (field.required && files.length === 0) {
      errors[field.name] = most === 1 ? "Add a picture." : "Add at least one picture.";
      continue;
    }
    if (files.length > most) {
      errors[field.name] = most === 1 ? "Add only one picture." : `Add at most ${most} pictures.`;
      continue;
    }
    for (const [i, file] of files.entries()) {
      const type = sniffPictureType(file.bytes);
      if (!type) {
        errors[field.name] = `${file.name || "A file"} is not a JPEG, PNG or WebP picture.`;
        break;
      }
      if (file.bytes.length > MAX_PICTURE_BYTES) {
        errors[field.name] = `${file.name || "A picture"} is over ${megabytes(MAX_PICTURE_BYTES)}.`;
        break;
      }
      total += file.bytes.length;
      const noun = field.pictureNoun ?? "picture";
      pictures.push({
        id: most === 1 ? noun : `${noun}_${i + 1}`,
        field: field.name,
        mediaType: type,
        base64: Buffer.from(file.bytes).toString("base64"),
        bytes: file.bytes.length,
      });
    }
  }

  if (pictures.length > MAX_PICTURES) errors._form ??= `A submission takes at most ${MAX_PICTURES} pictures.`;
  if (total > MAX_TOTAL_PICTURE_BYTES) errors._form ??= `The pictures together are over ${megabytes(MAX_TOTAL_PICTURE_BYTES)}.`;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, pictures };
}
