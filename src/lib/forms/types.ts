export type FieldKind = "text" | "email" | "textarea" | "select" | "pictures";

export interface FieldDef {
  /** The key in the submission and the form field's `name`. */
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required: boolean;
  /** Characters, for text fields. */
  readonly maxLength?: number;
  /** For `select` fields: the allowed values, in display order. */
  readonly options?: readonly string[];
  readonly rows?: number;
  /** For `pictures` fields: at most this many, 1 to 4. */
  readonly maxPictures?: number;
  /** For `pictures` fields: what each picture is, used in its id (`screenshot_1`). */
  readonly pictureNoun?: string;
  /** A line of help under the label. */
  readonly hint?: string;
}

export interface TeamDef {
  readonly id: string;
  readonly name: string;
  /** What belongs to this team, in plain words. Sent to the model as the option's criteria. */
  readonly criteria: string;
  /** Where a submission for this team goes, when that differs from the team's name. */
  readonly queue?: string;
}

/** The question that picks the team, a `choice` over the form's teams. */
export interface DestinationDef {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
}

/** What a raised flag does to the submission. */
export type FlagEffect =
  /** Held: shown, never delivered. */
  | { readonly kind: "hold" }
  /** Delivered and marked for a person to review. */
  | { readonly kind: "review" }
  /** Delivered with a next step for the team, such as asking for a clearer photo. */
  | { readonly kind: "outcome"; readonly outcome: string };

/** A yes-or-no check, a `truth` question. */
export interface FlagDef {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
  readonly ifTrue: string;
  readonly ifFalse: string;
  /** The answer in words, for a true and a false answer. */
  readonly trueLabel: string;
  readonly falseLabel: string;
  /** The answer that raises the flag. */
  readonly flagWhen: boolean;
  readonly effect: FlagEffect;
  /** What the result says when the flag is raised. */
  readonly flagNote: string;
  /** Asked only when the submission has a picture. */
  readonly withPictures?: boolean;
}

export type SampleKind = "clear" | "overlap" | "sparse";

export interface SampleDef {
  readonly kind: SampleKind;
  readonly label: string;
  readonly values: Readonly<Record<string, string>>;
  /** Paths under `public/`, by picture field name. */
  readonly pictures?: Readonly<Record<string, readonly string[]>>;
}

export interface UrgencyLevel {
  readonly label: string;
  readonly description: string;
}

export type IndustryId = "general" | "insurance" | "identity" | "property" | "public" | "finance" | "marketplaces";

export interface FormDef {
  readonly id: string;
  readonly industry: IndustryId;
  readonly title: string;
  /** The label on narrow screens. */
  readonly shortTitle: string;
  readonly summary: string;
  /** What the form is, as the model reads it in the state. */
  readonly context: string;
  readonly fields: readonly FieldDef[];
  readonly destination: DestinationDef;
  readonly teams: readonly TeamDef[];
  /** The team that takes what no model is sure of. One of `teams`. */
  readonly triageTeam: string;
  /** What urgency means for this form; left out, the form asks no urgency question. */
  readonly urgencyGuide?: string;
  readonly flags: readonly FlagDef[];
  readonly samples: readonly SampleDef[];
  /** A line the form shows, such as what it does not decide. */
  readonly notice?: string;
}

/** A picture of a submission, checked and ready to send. */
export interface Picture {
  /** The id the questions name it by, such as `photo_1`. */
  id: string;
  /** The picture field it came from. */
  field: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** Base64, no `data:` prefix. */
  base64: string;
  bytes: number;
}

export interface Submission {
  values: Record<string, string>;
  pictures: Picture[];
}
