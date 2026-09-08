/**
 * Shape helpers for the "Feedback rounds" profile section.
 *
 * The section renders the payload of `GET /builders/{accountId}/rounds` as a
 * list of credited rounds. Keeping the mapping here (framework-free) lets the
 * `nearbuilders.org` profile reuse the same view model and keeps it testable.
 */

export interface BuilderRoundInput {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  contributedMeaningfully: boolean;
  summary: string | null;
  writtenCount: number;
  recordedCount: number;
  issuesUrl: string | null;
  closedAt: string;
}

export interface BuilderRoundView {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  contributedMeaningfully: boolean;
  summary: string | null;
  /** e.g. "2 written · 1 recorded", or null when nothing was submitted in-app. */
  submissionsLabel: string | null;
  /** Link to the round repo's issues, when the round collected GitHub issues. */
  issuesUrl: string | null;
  /** Human date the round closed, e.g. "Apr 3, 2026". */
  closedOn: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatRoundDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function submissionsLabel(writtenCount: number, recordedCount: number): string | null {
  const parts: string[] = [];
  if (writtenCount > 0) parts.push(`${writtenCount} written`);
  if (recordedCount > 0) parts.push(`${recordedCount} recorded`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function toBuilderRoundViews(rounds: readonly BuilderRoundInput[]): BuilderRoundView[] {
  return rounds.map((round) => ({
    roundId: round.roundId,
    roundTitle: round.roundTitle,
    projectSlug: round.projectSlug,
    contributedMeaningfully: round.contributedMeaningfully,
    summary: round.summary,
    submissionsLabel: submissionsLabel(round.writtenCount, round.recordedCount),
    issuesUrl: round.issuesUrl,
    closedOn: formatRoundDate(round.closedAt),
  }));
}
