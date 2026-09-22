/**
 * View-model helpers for events read back from activity.nearbuilders.org.
 *
 * Framework-free so the builder profile and the `nearbuilders.org` profile can
 * share the same labelling and so it stays unit-testable.
 */

export interface ActivityEventInput {
  id: string;
  source: string;
  sourceDisplayName: string;
  type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface ActivityEventView {
  id: string;
  sourceLabel: string;
  /** Short human summary, e.g. "Opened round: Try onboarding". */
  summary: string;
  /** Human date, e.g. "Apr 3, 2026", or "" when the timestamp is unparseable. */
  on: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TYPE_LABELS: Record<string, string> = {
  "round.opened": "Opened round",
  "round.closed": "Closed round",
  "feedback.posted": "Posted feedback",
  "credit.awarded": "Credited on round",
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function toActivityEventViews(events: ActivityEventInput[]): ActivityEventView[] {
  return events.map((event) => {
    const label = TYPE_LABELS[event.type] ?? event.type;
    const detail =
      str(event.payload.title) ?? str(event.payload.roundTitle) ?? str(event.payload.projectSlug);
    return {
      id: event.id,
      sourceLabel: event.sourceDisplayName || event.source,
      summary: detail ? `${label}: ${detail}` : label,
      on: formatDate(event.timestamp),
    };
  });
}
