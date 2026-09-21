/**
 * View-model helpers for events read back from activity.nearbuilders.org.
 *
 * Framework-free so the builder profile and the `nearbuilders.org` profile can
 * share the same labelling and so it stays unit-testable.
 */

export const ACTIVITY_SITE_URL = "https://activity.nearbuilders.org";

/** "1 endorsement" / "12 endorsements". */
export function endorsementLabel(count: number): string {
  return `${count} ${count === 1 ? "endorsement" : "endorsements"}`;
}

/**
 * Activity's feed filtered to a round's opening event, where a signed-in user can
 * endorse it (endorsing needs an activity session, so it can't happen from here).
 */
export function roundActivityUrl(ownerAccountId: string): string {
  const query = new URLSearchParams({ actor: ownerAccountId, type: "round.opened" });
  return `${ACTIVITY_SITE_URL}/activity?${query}`;
}
