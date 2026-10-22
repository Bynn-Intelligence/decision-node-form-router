import { emailField, matchesFlag, nameField, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const street = {
  id: "street",
  industry: "public",
  title: "Report a street problem",
  shortTitle: "Street",
  summary: "A city's form for reporting problems in streets and parks, with optional photos.",
  context: "The City of Eastmere's online form for reporting problems in streets, pavements and parks.",
  fields: [
    nameField,
    emailField,
    { name: "location", label: "Where is it?", kind: "text", required: true, maxLength: 200 },
    { name: "problem", label: "What is the problem?", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
    {
      name: "photos",
      label: "Photos",
      kind: "pictures",
      required: false,
      maxPictures: 4,
      pictureNoun: "photo",
      hint: "Up to 4. JPEG, PNG or WebP.",
    },
  ],
  destination: teamQuestion,
  teams: [
    { id: "roads", name: "Roads", criteria: "Potholes, damaged road surfaces and pavements, road signs and things blocking a road." },
    { id: "street_lighting", name: "Street lighting", criteria: "Streetlights that are out, flickering, damaged or on during the day." },
    { id: "sanitation", name: "Sanitation", criteria: "Overflowing bins, dumped rubbish, missed collections and dead animals." },
    { id: "parks", name: "Parks and trees", criteria: "Parks, playgrounds, benches, and trees or branches that fell or may fall." },
    { id: "graffiti", name: "Graffiti", criteria: "Graffiti and fly-posting on public walls, signs and street furniture." },
    { id: "city_triage", name: "City triage", criteria: "Reports that fit no other team or do not say what the problem is." },
  ],
  triageTeam: "city_triage",
  urgencyGuide:
    "For a street problem, urgency is the danger to people: anything blocking or endangering traffic, cyclists or pedestrians comes first; graffiti and litter are low.",
  flags: [
    {
      id: "prank_or_duplicate",
      title: "Prank or duplicate",
      instructions: "Is this report a prank, a joke, or not about a real problem in a public place?",
      ifTrue: "A joke, an insult, a test, or a problem on private property or nowhere in particular.",
      ifFalse: "A real problem in a public place, even if it is described briefly.",
      trueLabel: "Likely a prank",
      falseLabel: "A real report",
      flagWhen: true,
      effect: { kind: "review" },
      flagNote: "This may be a prank or not a real problem: marked for a person to review.",
    },
    matchesFlag("photo"),
  ],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Ruth Kamau",
        email: "ruth.kamau@post.example",
        location: "Harbour Road, outside number 58",
        problem: "A deep pothole in the cycle lane. Two cyclists swerved into traffic to avoid it this morning.",
      },
      pictures: { photos: ["/samples/street/pothole.jpg"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Pavel Novak",
        email: "pavel.novak@mail.example",
        location: "Elm Avenue, by the park gate",
        problem: "A big branch came down in last night's storm. It knocked over a streetlight and is lying across the pavement.",
      },
      pictures: { photos: ["/samples/street/fallen-branch.jpg"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Jo", email: "jo@inbox.example", location: "Station underpass", problem: "look at this" },
      pictures: { photos: ["/samples/street/graffiti-wall.jpg"] },
    },
  ],
} as const satisfies FormDef;
