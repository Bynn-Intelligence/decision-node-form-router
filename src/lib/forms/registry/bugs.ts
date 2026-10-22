import { emailField, matchesFlag, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const bugs = {
  id: "bugs",
  industry: "general",
  title: "Bug reports",
  shortTitle: "Bugs",
  summary: "The bug report form linked from a web and mobile app, with optional screenshots.",
  context: "The bug report form linked from the web and mobile apps of Quillmere, job scheduling and invoicing software with a public API.",
  fields: [
    nameField,
    emailField,
    {
      name: "area",
      label: "Where did it happen?",
      kind: "select",
      required: false,
      maxLength: 40,
      options: ["Web app", "iOS app", "Android app", "API or webhooks", "Not sure"],
    },
    { name: "environment", label: "Browser, device or app version", kind: "text", required: false, maxLength: 200 },
    {
      name: "description",
      label: "What happened, and what did you expect?",
      kind: "textarea",
      required: true,
      maxLength: 4000,
      rows: 5,
    },
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
      id: "frontend",
      name: "Frontend",
      criteria: "What the browser app shows: layout, styling, buttons, forms, editors and dashboards that look or behave wrong.",
    },
    {
      id: "platform",
      name: "Platform",
      criteria: "Server errors, error 500 pages, slow or failing requests, outages, the public API and webhooks.",
    },
    {
      id: "identity",
      name: "Identity",
      criteria: "Signing in, sign-in loops, single sign-on, sessions that end, two-factor codes and permissions.",
    },
    {
      id: "mobile",
      name: "Mobile apps",
      criteria: "Crashes and bugs in the iOS or Android app: sync on the phone, notifications, the camera and offline mode.",
    },
    { id: "bug_triage", name: "Bug triage", criteria: "Reports that fit no other team or do not say where the problem is." },
  ],
  triageTeam: "bug_triage",
  urgencyGuide:
    "For a bug, urgency is the harm it does: an outage, lost or exposed data, payments failing or many users blocked is critical; a cosmetic glitch is low.",
  flags: [spamFlag, matchesFlag("screenshot")],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Mei Lin",
        email: "mei.lin@northgate-studio.example",
        area: "Web app",
        environment: "Chrome 141 on Windows 11",
        description:
          "Every page of the web app shows Error 500 since about 09:40. None of our 40 dispatchers can open today's jobs. Screenshot attached.",
      },
      pictures: { screenshots: ["/samples/bugs/error-500.png"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Jonas Berg",
        email: "jonas@fjordline-tours.example",
        area: "Web app",
        environment: "Safari 19 on macOS",
        description:
          "After I sign in, the dashboard flashes and I land on the sign-in page again. The layout of the page also looks broken for a second before it reloads.",
      },
      pictures: { screenshots: ["/samples/bugs/sign-in-loop.png"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Chris", email: "chris@post.example", area: "", environment: "", description: "this looks wrong" },
      pictures: { screenshots: ["/samples/bugs/layout-glitch.png"] },
    },
  ],
} as const satisfies FormDef;
