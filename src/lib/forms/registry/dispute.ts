import { emailField, matchesFlag, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const dispute = {
  id: "dispute",
  industry: "finance",
  title: "Dispute a charge",
  shortTitle: "Dispute",
  summary: "A bank customer's dispute of a card payment, with an optional statement or receipt screenshot.",
  context: "The card dispute form in the online bank of Pennyfold Bank.",
  notice: "Likely fraud is a flag for a person to review, never a rejection.",
  fields: [
    nameField,
    emailField,
    { name: "merchant", label: "Merchant", kind: "text", required: false, maxLength: 120 },
    { name: "amount", label: "Amount and date", kind: "text", required: false, maxLength: 80 },
    { name: "reason", label: "Why are you disputing it?", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
    {
      name: "screenshots",
      label: "Statement or receipt",
      kind: "pictures",
      required: false,
      maxPictures: 2,
      pictureNoun: "screenshot",
      hint: "Up to 2. JPEG, PNG or WebP.",
    },
  ],
  destination: teamQuestion,
  teams: [
    { id: "fraud", name: "Fraud", criteria: "Charges the customer did not make or authorise, a lost or stolen card, unknown merchants." },
    {
      id: "merchant_dispute",
      name: "Merchant disputes",
      criteria: "A purchase the customer made but goods never arrived, were not as described, or a service was not given.",
    },
    {
      id: "refund_not_received",
      name: "Refunds not received",
      criteria: "A merchant promised or confirmed a refund that has not reached the account.",
    },
    {
      id: "billing_error",
      name: "Billing errors",
      criteria: "A charge taken twice, a wrong amount, or a subscription charged after it was cancelled.",
    },
    { id: "disputes_triage", name: "Disputes triage", criteria: "Disputes that fit no other team or do not say what is wrong." },
  ],
  triageTeam: "disputes_triage",
  urgencyGuide:
    "For a dispute, urgency is the risk of more loss: a card being used by someone else right now is critical; a refund a few days late is normal.",
  flags: [
    {
      id: "likely_fraud",
      title: "Likely fraud",
      instructions: "Does this look like card fraud by someone other than the customer?",
      ifTrue: "Charges the customer says they never made, many charges in a short time, unknown merchants, or a lost or stolen card.",
      ifFalse: "A disagreement with a merchant the customer chose to pay, or a billing mistake.",
      trueLabel: "Likely fraud",
      falseLabel: "Not fraud",
      flagWhen: true,
      effect: { kind: "review" },
      flagNote: "Flagged as likely fraud for the fraud team to review. It is not a rejection.",
    },
    spamFlag,
    matchesFlag("screenshot"),
  ],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Sofia Brandt",
        email: "sofia.brandt@post.example",
        merchant: "Several, see screenshot",
        amount: "Four charges, 23 October",
        reason: "Four online charges I did not make, all within ten minutes last night. My card is in my wallet.",
      },
      pictures: { screenshots: ["/samples/dispute/unknown-charges.png"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Kwame Asante",
        email: "kwame.asante@mail.example",
        merchant: "Fernhill Outdoor Store",
        amount: "129.00, 2 October",
        reason:
          "I returned a tent and the shop emailed that the refund was sent on 9 October, but I have not received it. I think they also charged me twice for it.",
      },
      pictures: { screenshots: ["/samples/dispute/refund-promised.png"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Mo", email: "mo@inbox.example", merchant: "", amount: "", reason: "wrong amount" },
    },
  ],
} as const satisfies FormDef;
