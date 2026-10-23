import { emailField, matchesFlag, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const insurance = {
  id: "insurance",
  industry: "insurance",
  title: "Insurance claim",
  shortTitle: "Claim",
  summary: "A first notice of loss for home, car and contents insurance, with damage photos.",
  context: "The online claim form of Brackwater Mutual, a home, car and contents insurer.",
  fields: [
    nameField,
    emailField,
    { name: "policy", label: "Policy number", kind: "text", required: true, maxLength: 40 },
    { name: "date", label: "When did it happen?", kind: "text", required: false, maxLength: 60 },
    { name: "description", label: "What happened?", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
    {
      name: "photos",
      label: "Photos of the damage",
      kind: "pictures",
      required: true,
      maxPictures: 4,
      pictureNoun: "photo",
      hint: "1 to 4. JPEG, PNG or WebP.",
    },
  ],
  destination: teamQuestion,
  teams: [
    {
      id: "motor",
      name: "Motor claims",
      criteria: "Damage to a car or another vehicle: collisions, scratches, dents, broken glass and parking damage.",
    },
    {
      id: "property",
      name: "Property claims",
      criteria: "Damage to a home or building from fire, storm, impact or accident, other than water.",
    },
    {
      id: "water_damage",
      name: "Water damage",
      criteria: "Leaks, burst pipes, flooding and water coming through walls, floors or ceilings.",
    },
    {
      id: "theft",
      name: "Theft",
      criteria: "Burglary, break-ins and stolen belongings, from a home, a car or elsewhere.",
    },
    { id: "claims_triage", name: "Claims triage", criteria: "Claims that fit no other team or do not say what was damaged." },
  ],
  triageTeam: "claims_triage",
  urgencyGuide:
    "For a claim, urgency is how fast the damage grows or how unsafe the place is: water still coming in, a home that cannot be lived in or locked, or a car that cannot be driven raises it.",
  flags: [spamFlag, matchesFlag("photo")],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Hanna Lindqvist",
        email: "hanna.lindqvist@post.example",
        policy: "BM-HOME-448120",
        date: "This morning",
        description:
          "A pipe under the kitchen floor burst during the night. There is water across the kitchen and hallway floor and it is still seeping up. We have turned off the main valve.",
      },
      pictures: { photos: ["/samples/insurance/flooded-kitchen.jpg"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Marcus Bell",
        email: "marcus.bell@mail.example",
        policy: "BM-CAR-207731",
        date: "Last night",
        description:
          "Someone smashed the rear side window of my car while it was parked on the street outside our house, and took a laptop bag from the back seat. The seat is empty now apart from broken glass, and there is glass on the pavement.",
      },
      pictures: { photos: ["/samples/insurance/broken-car-window.jpg"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: {
        name: "Ada",
        email: "ada@inbox.example",
        policy: "BM-CAR-310045",
        date: "",
        description: "Damage, see photo.",
      },
      pictures: { photos: ["/samples/insurance/scratched-bumper.jpg"] },
    },
  ],
} as const satisfies FormDef;
