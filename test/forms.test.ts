import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FORMS, FORM_IDS, INDUSTRIES } from "@/lib/forms/definitions";
import { MAX_PICTURE_BYTES, checkPictures, sniffPictureType, type RawPicture } from "@/lib/forms/pictures";
import { parseValues, pictureFields, textFields } from "@/lib/forms/schema";
import type { FormDef } from "@/lib/forms/types";

const PUBLIC = join(__dirname, "..", "public");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0, ...new TextEncoder().encode("WEBP")]);

function pic(bytes: Uint8Array, name = "picture.png"): RawPicture {
  return { name, bytes };
}

describe("the registry", () => {
  it("has nine forms, each in a group of the picker", () => {
    expect(FORM_IDS).toHaveLength(9);
    const groups = new Set(INDUSTRIES.map((i) => i.id));
    for (const id of FORM_IDS) expect(groups).toContain(FORMS[id].industry);
  });
});

describe.each(FORM_IDS)("the %s form", (id) => {
  const form: FormDef = FORMS[id];
  const sample = form.samples[0];

  it("has three samples: clear, overlapping and little context", () => {
    expect(form.samples.map((s) => s.kind)).toEqual(["clear", "overlap", "sparse"]);
  });

  it("has unique teams, one of them its triage team", () => {
    const ids = form.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(form.triageTeam);
  });

  it("accepts each of its samples, whose pictures exist and are of an accepted type", () => {
    for (const s of form.samples) {
      expect(Object.keys(s.values).sort()).toEqual(textFields(form).map((f) => f.name).sort());
      const parsed = parseValues(form, s.values);
      expect(parsed.ok, `${s.kind}: ${JSON.stringify(parsed)}`).toBe(true);
      const files: Record<string, RawPicture[]> = {};
      for (const [field, paths] of Object.entries(s.pictures ?? {})) {
        files[field] = paths.map((p) => {
          const file = join(PUBLIC, p);
          expect(existsSync(file), `${p} exists`).toBe(true);
          return pic(new Uint8Array(readFileSync(file)), p);
        });
      }
      const pictures = checkPictures(form, files);
      expect(pictures.ok, `${s.kind}: ${JSON.stringify(pictures.ok ? "" : pictures.errors)}`).toBe(true);
    }
  });

  it("rejects a missing required field", () => {
    for (const field of textFields(form).filter((f) => f.required)) {
      const parsed = parseValues(form, { ...sample.values, [field.name]: "  " });
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) expect(parsed.errors[field.name]).toBe("This field is required.");
    }
  });

  it("rejects a field over its length", () => {
    const field = textFields(form).find((f) => f.kind === "textarea" || f.kind === "text")!;
    const parsed = parseValues(form, { ...sample.values, [field.name]: "x".repeat((field.maxLength ?? 4000) + 1) });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[field.name]).toMatch(/at most/);
  });

  it("rejects an address that is not an email", () => {
    const parsed = parseValues(form, { ...sample.values, email: "not an email" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.email).toMatch(/Enter an email address/);
  });

  it("rejects fields the form does not define", () => {
    const parsed = parseValues(form, { ...sample.values, admin: "true" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors._form).toBeDefined();
  });

  it("checks its pictures: count, type and size", () => {
    for (const field of pictureFields(form)) {
      const most = field.maxPictures ?? 4;
      const none = checkPictures(form, { [field.name]: [] });
      if (field.required) expect(none.ok).toBe(false);

      const tooMany = checkPictures(form, { [field.name]: Array.from({ length: most + 1 }, () => pic(PNG)) });
      expect(tooMany.ok).toBe(false);

      const wrongType = checkPictures(form, { [field.name]: [pic(new TextEncoder().encode("%PDF-1.7"), "scan.pdf")] });
      expect(wrongType.ok).toBe(false);
      if (!wrongType.ok) expect(wrongType.errors[field.name]).toMatch(/scan\.pdf is not a JPEG, PNG or WebP/);

      const big = new Uint8Array(MAX_PICTURE_BYTES + 1);
      big.set(JPEG);
      const tooBig = checkPictures(form, { [field.name]: [pic(big, "huge.jpg")] });
      expect(tooBig.ok).toBe(false);
      if (!tooBig.ok) expect(tooBig.errors[field.name]).toMatch(/over 5 MB/);

      const good = checkPictures(form, { [field.name]: [pic(JPEG)] });
      expect(good.ok).toBe(true);
      if (good.ok) expect(good.pictures[0]).toMatchObject({ field: field.name, mediaType: "image/jpeg" });
    }
  });
});

describe("pictures", () => {
  it("reads the type from the bytes", () => {
    expect(sniffPictureType(PNG)).toBe("image/png");
    expect(sniffPictureType(JPEG)).toBe("image/jpeg");
    expect(sniffPictureType(WEBP)).toBe("image/webp");
    expect(sniffPictureType(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("names each picture for the questions", () => {
    const support = checkPictures(FORMS.support, { screenshots: [pic(PNG), pic(JPEG)] });
    expect(support.ok && support.pictures.map((p) => p.id)).toEqual(["screenshot_1", "screenshot_2"]);
    const identity = checkPictures(FORMS.identity, { document: [pic(PNG)] });
    expect(identity.ok && identity.pictures.map((p) => p.id)).toEqual(["document"]);
  });

  it("requires the claim's photos and leaves the contact form's screenshots optional", () => {
    expect(checkPictures(FORMS.insurance, {}).ok).toBe(false);
    expect(checkPictures(FORMS.support, {}).ok).toBe(true);
  });
});
