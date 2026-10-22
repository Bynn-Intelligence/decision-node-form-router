import { emailField, matchesFlag, nameField, spamFlag, teamQuestion } from "../common";
import type { FormDef } from "../types";

export const maintenance = {
  id: "maintenance",
  industry: "property",
  title: "Maintenance request",
  shortTitle: "Maintenance",
  summary: "A tenant's repair request to a property manager, with optional photos.",
  context: "The repair request form for tenants of Marrowby Homes, which manages rental flats.",
  fields: [
    nameField,
    emailField,
    { name: "address", label: "Flat and address", kind: "text", required: true, maxLength: 160 },
    { name: "problem", label: "What is wrong?", kind: "textarea", required: true, maxLength: 4000, rows: 5 },
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
    { id: "plumbing", name: "Plumbing", criteria: "Leaks, drips, blocked drains, toilets, taps, pipes and water heaters." },
    { id: "electrical", name: "Electrical", criteria: "Power cuts in the flat, sockets, switches, lights, fuses and burning smells." },
    { id: "heating", name: "Heating", criteria: "Radiators, boilers, thermostats and a flat that is too cold." },
    { id: "appliances", name: "Appliances", criteria: "The landlord's fridge, oven, hob, washing machine and dishwasher." },
    { id: "pest_control", name: "Pest control", criteria: "Mice, rats, cockroaches, bedbugs, wasps and other pests." },
    { id: "maintenance_triage", name: "Maintenance triage", criteria: "Requests that fit no other trade or do not say what is wrong." },
  ],
  triageTeam: "maintenance_triage",
  urgencyGuide:
    "For a repair, urgency is the risk to people and the building: water coming through a ceiling, no heat in winter, exposed wiring or a burning smell is an emergency; a dripping tap is low.",
  flags: [spamFlag, matchesFlag("photo")],
  samples: [
    {
      kind: "clear",
      label: "Clear",
      values: {
        name: "Oskar Nilsson",
        email: "oskar.n@post.example",
        address: "Flat 4B, 12 Linden Row",
        problem: "The pipe under the kitchen sink is leaking. There is a puddle in the cupboard and I have put a bowl under it.",
      },
      pictures: { photos: ["/samples/maintenance/leaking-pipe.jpg"] },
    },
    {
      kind: "overlap",
      label: "Overlapping needs",
      values: {
        name: "Grace Adeyemi",
        email: "grace.adeyemi@mail.example",
        address: "Flat 9, 3 Quarry Lane",
        problem: "Water is dripping from the ceiling light in the bathroom. The light still works.",
      },
      pictures: { photos: ["/samples/maintenance/ceiling-light-drip.jpg"] },
    },
    {
      kind: "sparse",
      label: "Little context",
      values: { name: "Lee", email: "lee@inbox.example", address: "Flat 2, 7 Mill Street", problem: "broken again" },
      pictures: { photos: ["/samples/maintenance/cold-radiator.jpg"] },
    },
  ],
} as const satisfies FormDef;
