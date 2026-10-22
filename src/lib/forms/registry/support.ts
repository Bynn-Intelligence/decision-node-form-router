import { emailField, matchesFlag, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const support = {
  id: "support",
  industry: "general",
  title: "Customer contact",
  shortTitle: "Contact",
  summary: "The help form in a software product's account area, with optional screenshots.",
  context: "The contact form in the account area of Quillmere, job scheduling and invoicing software for service businesses.",
  fields: [
    nameField,
    emailField,
    { name: "account", label: "Account or invoice number", kind: "text", required: false, maxLength: 60 },
    { name: "subject", label: "Subject", kind: "text", required: true, maxLength: 160 },
    { name: "message", label: "Message", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
    {
      name: "screenshots",
      label: "Screenshots",
      kind: "pictures",
      required: false,
      maxPictures: 4,
      pictureNoun: "screenshot",
      hint: "Up to 4. JPEG, PNG or WebP.",
    },
  ],
  destination: teamQuestion,
  teams: [
    {
      id: "billing",
      name: "Billing",
      criteria: "Charges, refunds, invoices, receipts, plan changes, failed payments and tax questions.",
    },
    {
      id: "technical_support",
      name: "Technical support",
      criteria: "Error messages, something that does not work as it should, imports, exports and integrations.",
    },
    {
      id: "account_access",
      name: "Account access",
      criteria: "Signing in, password resets, two-factor codes, locked accounts, and adding or removing users.",
    },
    {
      id: "customer_care",
      name: "Customer care",
      criteria: "Anything that fits no other team: feedback, complaints, cancellations and unclear requests.",
    },
  ],
  triageTeam: "customer_care",
  urgencyGuide:
    "For a customer message, urgency is how much it hurts the customer now: a locked account, a team that cannot work, or a wrong charge raises it.",
  flags: [spamFlag, matchesFlag("screenshot")],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Ines Moreau",
        email: "ines.moreau@kestrel-dental.example",
        account: "INV-20977",
        subject: "Charged twice for October",
        message:
          "We were charged twice for October: invoices INV-20931 and INV-20977, both 49.00 on the same day. Please refund one of them and confirm by email. Screenshot of our billing page attached.",
      },
      pictures: { screenshots: ["/samples/support/double-charge.png"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Daniel Okafor",
        email: "d.okafor@riverbend-clinic.example",
        account: "ACC-55120",
        subject: "Locked out after changing card",
        message:
          "Since I updated our company card yesterday, none of us can sign in, and the account page said the last payment failed. Six people cannot open their schedules today.",
      },
      pictures: { screenshots: ["/samples/support/account-locked.png"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Alex", email: "alex@inbox.example", account: "", subject: "Help", message: "See attached." },
      pictures: { screenshots: ["/samples/support/export-error.png"] },
    },
  ],
} as const satisfies FormDef;
