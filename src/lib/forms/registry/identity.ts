import { emailField, spamFlag } from "../common";
import type { FormDef } from "../types";

const accepted = "Document check";

export const identity = {
  id: "identity",
  industry: "identity",
  title: "Identity verification",
  shortTitle: "Identity",
  summary: "The document step of opening an account, with one photo of an identity document.",
  context: "The identity document step of opening an account at Keystead, an online bank.",
  notice:
    "This form only sorts submissions for a person to handle. It does not verify identity or decide anything about a person. The samples are SPECIMEN documents with invented names.",
  fields: [
    { name: "full_name", label: "Full name, as on the document", kind: "text", required: true, maxLength: 120 },
    emailField,
    {
      name: "document",
      label: "Photo of your identity document",
      kind: "pictures",
      required: true,
      maxPictures: 1,
      pictureNoun: "document",
      hint: "One photo of the page with your photo and name. JPEG, PNG or WebP.",
    },
  ],
  destination: {
    id: "document_type",
    title: "Document type",
    instructions: "What kind of document does the photo show? Follow the document rules when they are given.",
  },
  teams: [
    { id: "passport", name: "Passport", criteria: "A passport's photo page.", queue: accepted },
    { id: "national_id", name: "National ID card", criteria: "A national identity card.", queue: accepted },
    // not accepted for opening an account: a person asks for another document (knowledge/identity/always.md)
    { id: "driving_licence", name: "Driving licence", criteria: "A driving licence card.", queue: "Manual review" },
    { id: "residence_permit", name: "Residence permit", criteria: "A residence permit card.", queue: accepted },
    {
      id: "not_a_document",
      name: "Not an identity document",
      criteria: "Anything else: a bank card, a receipt, a letter, a selfie, a screenshot or an unrelated picture.",
      queue: "Reply: not an identity document",
    },
    {
      id: "manual_review",
      name: "Manual review",
      criteria: "A document whose type cannot be told from the photo.",
      queue: "Manual review",
    },
  ],
  triageTeam: "manual_review",
  flags: [
    {
      id: "readable",
      title: "Readable and complete",
      instructions: "Is the whole document in the photo, in focus, and is its text readable?",
      ifTrue: "All four corners are in the photo and the name, dates and numbers can be read.",
      ifFalse: "The document is cut off, blurred, too dark, covered by glare, or its text cannot be read.",
      trueLabel: "Readable",
      falseLabel: "Not readable",
      flagWhen: false,
      effect: { kind: "outcome", outcome: "Ask for a clearer photo" },
      flagNote: "The document cannot be read: ask the person for a clearer photo.",
      withPictures: true,
    },
    {
      id: "name_matches",
      title: "Name matches",
      instructions: "Does the name on the document match the full name the person typed?",
      ifTrue: "The same name, allowing for letter case, accents and a missing middle name.",
      ifFalse: "A different name, or no name can be read on the document.",
      trueLabel: "Matches",
      falseLabel: "Does not match",
      flagWhen: false,
      effect: { kind: "review" },
      flagNote: "The name typed and the name on the document differ: marked for a person to review.",
      withPictures: true,
    },
    spamFlag,
  ],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: { full_name: "Elin Marsh Varga", email: "elin.varga@post.example" },
      pictures: { document: ["/samples/identity/specimen-passport.jpg"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: { full_name: "Robbie Okonkwo", email: "robbie.o@mail.example" },
      pictures: { document: ["/samples/identity/specimen-licence.jpg"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { full_name: "Noor Haddad", email: "noor@inbox.example" },
      pictures: { document: ["/samples/identity/specimen-id-blurred.jpg"] },
    },
  ],
} as const satisfies FormDef;
