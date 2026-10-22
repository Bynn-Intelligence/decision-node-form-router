import { emailField, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const sales = {
  id: "sales",
  industry: "general",
  title: "Sales leads",
  shortTitle: "Sales",
  summary: "The contact-sales form on a software company's pricing page.",
  context: "The contact-sales form on the pricing page of Quillmere, job scheduling and invoicing software for service businesses.",
  fields: [
    nameField,
    { ...emailField, label: "Work email" },
    { name: "company", label: "Company", kind: "text", required: false, maxLength: 120 },
    {
      name: "team_size",
      label: "Team size",
      kind: "select",
      required: false,
      maxLength: 40,
      options: ["1 to 10", "11 to 50", "51 to 200", "201 to 1,000", "More than 1,000"],
    },
    { name: "message", label: "How can we help?", kind: "textarea", required: true, maxLength: 4000, rows: 6 },
  ],
  destination: teamQuestion,
  teams: [
    {
      id: "enterprise",
      name: "Enterprise sales",
      criteria:
        "Organizations of more than 200 people, or any request for single sign-on, a security review, a custom contract, purchase-order invoicing or data residency.",
    },
    {
      id: "small_business",
      name: "Small business sales",
      criteria: "Teams of up to 200 people asking about plans, pricing, a trial or getting started, with no custom contract terms.",
    },
    {
      id: "partnerships",
      name: "Partnerships",
      criteria: "Agencies, resellers, consultants and software vendors who want to resell, refer customers or build an integration.",
    },
    { id: "sales_triage", name: "Sales triage", criteria: "Anything that fits no other team, or is not a sales inquiry at all." },
  ],
  triageTeam: "sales_triage",
  urgencyGuide:
    "For a sales lead, urgency is how soon the sender needs a reply: a deadline, a renewal date or a purchase decision this week raises it.",
  flags: [spamFlag],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Priya Raman",
        email: "priya.raman@halvorsen-freight.example",
        company: "Halvorsen Freight",
        team_size: "More than 1,000",
        message:
          "We are moving 1,400 people to one platform before our current contract ends on the 30th. We need single sign-on with our identity provider, a data processing agreement, and annual invoicing by purchase order. Our security team will send a questionnaire this week.",
      },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Tomás Ilić",
        email: "tomas@brightfold.example",
        company: "Brightfold Studio",
        team_size: "11 to 50",
        message:
          "We are a 25-person digital agency. We would like a plan for our own team, and we are also thinking about offering it to our clients under a referral or reseller arrangement. What would pricing look like for both?",
      },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Sam", email: "sam.k@mailbox.example", company: "", team_size: "", message: "pricing?" },
    },
  ],
} as const satisfies FormDef;
