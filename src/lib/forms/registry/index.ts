import type { FormDef, IndustryId } from "../types";
import { bugs } from "./bugs";
import { dispute } from "./dispute";
import { identity } from "./identity";
import { insurance } from "./insurance";
import { maintenance } from "./maintenance";
import { marketplace } from "./marketplace";
import { sales } from "./sales";
import { street } from "./street";
import { support } from "./support";

/** Every form, by id. A new form is one entry here, its samples' pictures in `public/samples/<id>/`, and its playbook in `knowledge/<id>/`. */
export const FORMS = { sales, support, bugs, insurance, identity, maintenance, street, dispute, marketplace } as const;

export type FormId = keyof typeof FORMS;
export type TeamId<F extends FormId> = (typeof FORMS)[F]["teams"][number]["id"];

export const FORM_IDS = Object.keys(FORMS) as FormId[];

/** The picker's groups, in order. */
export const INDUSTRIES: readonly { id: IndustryId; title: string }[] = [
  { id: "general", title: "General business" },
  { id: "insurance", title: "Insurance" },
  { id: "identity", title: "Identity" },
  { id: "property", title: "Property" },
  { id: "public", title: "Public sector" },
  { id: "finance", title: "Finance" },
  { id: "marketplaces", title: "Marketplaces" },
];

export function isFormId(value: unknown): value is FormId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FORMS, value);
}

export function getForm(id: FormId): FormDef {
  return FORMS[id];
}
