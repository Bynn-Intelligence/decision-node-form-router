import type { DestinationDef, FieldDef, FlagDef, UrgencyLevel } from "./types";

export const nameField: FieldDef = { name: "name", label: "Name", kind: "text", required: true, maxLength: 120 };
export const emailField: FieldDef = { name: "email", label: "Email", kind: "email", required: true, maxLength: 254 };

/** Low to high, the levels of every form's urgency question. */
export const URGENCY_LEVELS: readonly UrgencyLevel[] = [
  { label: "Low", description: "can wait a week or more" },
  { label: "Normal", description: "an answer within a few business days is fine" },
  { label: "High", description: "needs an answer today" },
  { label: "Critical", description: "someone is blocked or unsafe, or money, data or security is at risk right now" },
];

export const teamQuestion: DestinationDef = {
  id: "team",
  title: "Team",
  instructions: "Which team should handle this submission? Follow the routing rules when they are given; otherwise pick the team whose description fits best.",
};

export const spamFlag: FlagDef = {
  id: "spam",
  title: "Spam check",
  instructions: "Is this submission spam?",
  ifTrue: "Spam: unsolicited advertising, link or SEO offers, scams, phishing, or text with no real request.",
  ifFalse: "A genuine submission from a real person, even if it is short, vague or rude.",
  trueLabel: "Spam",
  falseLabel: "Not spam",
  flagWhen: true,
  effect: { kind: "hold" },
  flagNote: "Held as spam: shown here, not delivered.",
};

/** "Does the picture fit what the customer wrote?", asked only with a picture. */
export function matchesFlag(what: string): FlagDef {
  return {
    id: "matches",
    title: "Picture fits",
    instructions: `Does the attached ${what} fit what the person wrote?`,
    ifTrue: `The ${what} shows what the text describes, or something consistent with it.`,
    ifFalse: `The ${what} shows something else, or contradicts the text.`,
    trueLabel: "Fits the text",
    falseLabel: "Does not fit the text",
    flagWhen: false,
    effect: { kind: "review" },
    flagNote: `The ${what} does not fit what was written: marked for a person to review.`,
    withPictures: true,
  };
}
