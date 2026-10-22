import { emailField, matchesFlag, nameField, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const marketplace = {
  id: "marketplace",
  industry: "marketplaces",
  title: "Report a listing or seller",
  shortTitle: "Listing",
  summary: "A marketplace's report form for listings and sellers, with an optional listing screenshot.",
  context: "The report form of Swapfield, an online marketplace for new and used goods.",
  notice: "A bad-faith report is a flag for a person to review, never a rejection.",
  fields: [
    nameField,
    emailField,
    { name: "listing", label: "Listing link or number", kind: "text", required: false, maxLength: 200 },
    { name: "report", label: "What is wrong with it?", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
    {
      name: "screenshots",
      label: "Screenshot of the listing",
      kind: "pictures",
      required: false,
      maxPictures: 2,
      pictureNoun: "screenshot",
      hint: "Up to 2. JPEG, PNG or WebP.",
    },
  ],
  destination: teamQuestion,
  teams: [
    { id: "counterfeit", name: "Counterfeit", criteria: "Fake branded goods and replicas sold as genuine." },
    {
      id: "prohibited_item",
      name: "Prohibited items",
      criteria: "Items the marketplace does not allow: weapons, drugs, live animals, medicines, and recalled products.",
    },
    {
      id: "scam",
      name: "Scams",
      criteria: "Sellers who take payment and never send, ask to pay outside the marketplace, or use fake identities.",
    },
    {
      id: "misleading_listing",
      name: "Misleading listings",
      criteria: "Listings whose photos, description, condition or price do not match the item.",
    },
    { id: "trust_triage", name: "Trust triage", criteria: "Reports that fit no other team or do not say what is wrong." },
  ],
  triageTeam: "trust_triage",
  urgencyGuide:
    "For a report, urgency is the harm to buyers: a scam taking payments now or a dangerous item is critical; a wrong colour in a description is low.",
  flags: [
    {
      id: "bad_faith",
      title: "Bad-faith report",
      instructions: "Does this report look made in bad faith, such as by a competing seller or as revenge, with no real problem described?",
      ifTrue: "No real problem described, insults, a competitor's grievance, or a dispute about something else.",
      ifFalse: "A genuine report of a problem with the listing or seller.",
      trueLabel: "Likely bad faith",
      falseLabel: "Made in good faith",
      flagWhen: true,
      effect: { kind: "review" },
      flagNote: "This report may be made in bad faith: marked for a person to review. It is not a rejection.",
    },
    matchesFlag("screenshot"),
  ],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Lena Fischer",
        email: "lena.fischer@post.example",
        listing: "swapfield listing 88213407",
        report:
          "This seller lists 'genuine' luxury watches at 95% off, twelve of the same model, with stock photos. These are replicas sold as the real thing.",
      },
      pictures: { screenshots: ["/samples/marketplace/replica-watch.png"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Arjun Mehta",
        email: "arjun.mehta@mail.example",
        listing: "swapfield listing 90311552",
        report:
          "A listing for puppies. The seller asked me to pay a deposit by gift card outside the site before I could see them.",
      },
      pictures: { screenshots: ["/samples/marketplace/puppy-listing.png"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Kai", email: "kai@inbox.example", listing: "", report: "this seller is the worst, ban him" },
    },
  ],
} as const satisfies FormDef;
