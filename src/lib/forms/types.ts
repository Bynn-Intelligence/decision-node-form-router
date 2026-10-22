export type FieldKind = "text" | "email" | "textarea" | "select";

export interface FieldDef {
  /** The key in the submission and the form field's `name`. */
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required: boolean;
  readonly maxLength: number;
  /** For `select` fields: the allowed values, in display order. */
  readonly options?: readonly string[];
  readonly placeholder?: string;
  readonly rows?: number;
}

export interface TeamDef {
  readonly id: string;
  readonly name: string;
  /** What belongs to this team, in plain words. Sent to the model as the option's criteria. */
  readonly criteria: string;
}

export type SampleKind = "clear" | "overlap" | "sparse";

export interface SampleDef {
  readonly kind: SampleKind;
  readonly label: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface UrgencyLevel {
  readonly label: string;
  readonly description: string;
}

export interface FormDef {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  /** What the form is, as the model reads it in the state. */
  readonly context: string;
  readonly fields: readonly FieldDef[];
  readonly teams: readonly TeamDef[];
  /** The team that takes what no model is sure of. One of `teams`. */
  readonly triageTeam: string;
  /** What urgency means for this form, added to the urgency question. */
  readonly urgencyGuide: string;
  readonly samples: readonly SampleDef[];
}

export type Submission = Record<string, string>;
