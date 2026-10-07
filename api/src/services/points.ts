export const POINTS_PER_ACCEPTED_FEEDBACK = 10;
/** Bonus on top of the accepted points when a round manager stars an accepted submission (#104). */
export const BONUS_POINTS_PER_STARRED_FEEDBACK = 5;

export type PointsPeriod = "weekly" | "monthly" | "all-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export function pointsForAccepted(acceptedCount: number): number {
  return Math.max(0, acceptedCount) * POINTS_PER_ACCEPTED_FEEDBACK;
}

/**
 * Starred bonus. Only accepted submissions can earn it, so a star can never outscore the
 * accepted count: starring unresolved or dismissed feedback is worth nothing.
 */
export function bonusPointsForStarred(starredCount: number, acceptedCount: number): number {
  return (
    Math.min(Math.max(0, starredCount), Math.max(0, acceptedCount)) *
    BONUS_POINTS_PER_STARRED_FEEDBACK
  );
}

export function totalPoints(acceptedCount: number, starredCount: number): number {
  return pointsForAccepted(acceptedCount) + bonusPointsForStarred(starredCount, acceptedCount);
}

export function periodStart(period: PointsPeriod, now: Date = new Date()): Date | null {
  switch (period) {
    case "weekly":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "monthly":
      return new Date(now.getTime() - 30 * DAY_MS);
    case "all-time":
      return null;
  }
}

export interface AcceptedCount {
  accountId: string;
  acceptedCount: number;
  /** Accepted submissions that a round manager also starred. */
  starredCount?: number;
}

export interface PointsStanding {
  rank: number;
  accountId: string;
  points: number;
  acceptedCount: number;
  starredCount: number;
  bonusPoints: number;
}

export function rankStandings(counts: AcceptedCount[]): PointsStanding[] {
  const entries = counts
    .filter((entry) => entry.acceptedCount > 0)
    .map((entry) => {
      const starredCount = Math.min(entry.starredCount ?? 0, entry.acceptedCount);
      return {
        accountId: entry.accountId,
        acceptedCount: entry.acceptedCount,
        starredCount,
        bonusPoints: bonusPointsForStarred(starredCount, entry.acceptedCount),
        points: totalPoints(entry.acceptedCount, starredCount),
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.acceptedCount - a.acceptedCount ||
        a.accountId.localeCompare(b.accountId),
    );
  let rank = 0;
  let previous: number | null = null;
  return entries.map((entry, index) => {
    if (previous === null || entry.points !== previous) rank = index + 1;
    previous = entry.points;
    return { rank, ...entry };
  });
}
