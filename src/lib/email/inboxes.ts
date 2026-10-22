import "server-only";
import type { FormId, TeamId } from "../forms/definitions";

/**
 * Where each team's routed submissions are emailed. Server only: addresses
 * never reach the page. A team left out gets a preview instead of an email.
 * The keys are checked against the forms' team ids, so a typo fails the build.
 */
export const TEAM_INBOXES: { [F in FormId]: Partial<Record<TeamId<F>, string>> } = {
  sales: {
    // enterprise: "enterprise-sales@yourcompany.example",
  },
  support: {},
  bugs: {},
  insurance: {},
  identity: {},
  maintenance: {},
  street: {},
  dispute: {},
  marketplace: {},
};

export function inboxFor(formId: FormId, teamId: string): string | null {
  const inboxes = TEAM_INBOXES[formId] as Record<string, string | undefined>;
  const address = inboxes[teamId]?.trim();
  return address ? address : null;
}
