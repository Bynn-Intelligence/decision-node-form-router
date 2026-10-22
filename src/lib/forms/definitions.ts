import type { FieldDef, FormDef, UrgencyLevel } from "./types";

const name: FieldDef = { name: "name", label: "Name", kind: "text", required: true, maxLength: 120 };
const email: FieldDef = { name: "email", label: "Email", kind: "email", required: true, maxLength: 254 };

/** Low to high, the levels of the urgency question on every form. */
export const URGENCY_LEVELS: readonly UrgencyLevel[] = [
  { label: "Low", description: "can wait a week or more" },
  { label: "Normal", description: "an answer within a few business days is fine" },
  { label: "High", description: "needs an answer today" },
  { label: "Critical", description: "work is blocked, or money, data or security is at risk right now" },
];

const sales = {
  id: "sales",
  title: "Sales leads",
  summary: "A contact-sales form on a pricing page.",
  context: "A contact-sales form on the pricing page of a business software product.",
  fields: [
    name,
    { ...email, label: "Work email" },
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
      criteria:
        "Teams of up to 200 people asking about plans, pricing, a trial or getting started, with no custom contract terms.",
    },
    {
      id: "partnerships",
      name: "Partnerships",
      criteria:
        "Agencies, resellers, consultants and software vendors who want to resell, refer customers or build an integration.",
    },
    {
      id: "sales_triage",
      name: "Sales triage",
      criteria: "Anything that fits no other team, or is not a sales inquiry at all.",
    },
  ],
  triageTeam: "sales_triage",
  urgencyGuide:
    "For a sales lead, urgency is how soon the sender needs a reply: a deadline, a renewal date or a purchase decision this week raises it.",
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
      values: {
        name: "Sam",
        email: "sam.k@mailbox.example",
        company: "",
        team_size: "",
        message: "pricing?",
      },
    },
  ],
} as const satisfies FormDef;

const support = {
  id: "support",
  title: "Customer contact",
  summary: "A help form in the account area.",
  context: "The contact form in the account area of a subscription software product.",
  fields: [
    name,
    email,
    { name: "account", label: "Account or invoice number", kind: "text", required: false, maxLength: 60 },
    { name: "subject", label: "Subject", kind: "text", required: true, maxLength: 160 },
    { name: "message", label: "Message", kind: "textarea", required: true, maxLength: 4000, rows: 6 },
  ],
  teams: [
    {
      id: "billing",
      name: "Billing",
      criteria: "Charges, refunds, invoices, receipts, plan changes, failed payments and tax questions.",
    },
    {
      id: "account_security",
      name: "Account and security",
      criteria:
        "Signing in, password resets, two-factor codes, locked or compromised accounts, and adding or removing users.",
    },
    {
      id: "product_support",
      name: "Product support",
      criteria: "How to use a feature, settings, imports and exports, and how something works.",
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
          "We were charged twice for October: invoices INV-20931 and INV-20977, both 49.00 on the same day. Please refund one of them and confirm by email.",
      },
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
          "Since I updated our company card yesterday, none of us can sign in, and the account page says the last payment failed. Six people cannot open their schedules today.",
      },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: {
        name: "Alex",
        email: "alex@inbox.example",
        account: "",
        subject: "Help",
        message: "It's not working again.",
      },
    },
  ],
} as const satisfies FormDef;

const bugs = {
  id: "bugs",
  title: "Bug reports",
  summary: "A bug report form linked from the app.",
  context: "The bug report form linked from the web and mobile apps of a software product with a public API.",
  fields: [
    name,
    email,
    {
      name: "area",
      label: "Where did it happen?",
      kind: "select",
      required: false,
      maxLength: 40,
      options: ["Web app", "iOS app", "Android app", "API or webhooks", "Not sure"],
    },
    {
      name: "environment",
      label: "Browser, device or app version",
      kind: "text",
      required: false,
      maxLength: 200,
    },
    {
      name: "description",
      label: "What happened, and what did you expect?",
      kind: "textarea",
      required: true,
      maxLength: 4000,
      rows: 5,
    },
    { name: "steps", label: "Steps to reproduce", kind: "textarea", required: false, maxLength: 4000, rows: 4 },
  ],
  teams: [
    {
      id: "web",
      name: "Web app",
      criteria: "Bugs in the browser app: pages, editors, dashboards, exports and anything seen in a web browser.",
    },
    {
      id: "mobile",
      name: "Mobile apps",
      criteria: "Bugs in the iOS or Android app: crashes, sync on the phone, notifications, the camera and offline mode.",
    },
    {
      id: "api",
      name: "API and integrations",
      criteria: "Errors from the public API, webhooks, SDKs and connections to other software.",
    },
    {
      id: "bug_triage",
      name: "Bug triage",
      criteria: "Reports that fit no other team or do not say where the problem is.",
    },
  ],
  triageTeam: "bug_triage",
  urgencyGuide:
    "For a bug, urgency is the harm it does: lost or exposed data, payments failing, or many users blocked is critical; a cosmetic glitch is low.",
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Mei Lin",
        email: "mei.lin@northgate-studio.example",
        area: "iOS app",
        environment: "iPhone 15, iOS 19.1, app 4.12.0",
        description:
          "The app crashes every time I open a photo attachment on a job. It started after the 4.12.0 update. I expected the photo to open full screen.",
        steps: "1. Open any job with a photo attached\n2. Tap the photo\n3. The app closes",
      },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Jonas Berg",
        email: "jonas@fjordline-tours.example",
        area: "Not sure",
        environment: "Chrome 141 on macOS",
        description:
          "Our booking webhook stopped receiving events this morning, but the dashboard in the browser shows them as delivered. The CSV export from the web app is also missing the same bookings.",
        steps: "",
      },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: {
        name: "Chris",
        email: "chris@post.example",
        area: "",
        environment: "",
        description: "sync broken",
        steps: "",
      },
    },
  ],
} as const satisfies FormDef;

export const FORMS = { sales, support, bugs } as const;

export type FormId = keyof typeof FORMS;
export type TeamId<F extends FormId> = (typeof FORMS)[F]["teams"][number]["id"];

export const FORM_IDS = Object.keys(FORMS) as FormId[];

export function isFormId(value: unknown): value is FormId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FORMS, value);
}

export function getForm(id: FormId): FormDef {
  return FORMS[id];
}
