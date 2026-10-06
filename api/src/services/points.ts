export const POINTS_PER_ACCEPTED_FEEDBACK = 10;

export type PointsPeriod = "weekly" | "monthly" | "all-time";

const DAY_MS = 24 * 60 * 60 * 1000;

export function pointsForAccepted(acceptedCount: number): number {
  return Math.max(0, acceptedCount) * POINTS_PER_ACCEPTED_FEEDBACK;
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
}

export interface PointsStanding {
  rank: number;
  accountId: string;
  points: number;
  acceptedCount: number;
}

export function rankStandings(counts: AcceptedCount[]): PointsStanding[] {
  const sorted = [...counts]
    .filter((entry) => entry.acceptedCount > 0)
    .sort((a, b) => b.acceptedCount - a.acceptedCount || a.accountId.localeCompare(b.accountId));
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((entry, index) => {
    if (previous === null || entry.acceptedCount !== previous) rank = index + 1;
    previous = entry.acceptedCount;
    return {
      rank,
      accountId: entry.accountId,
      points: pointsForAccepted(entry.acceptedCount),
      acceptedCount: entry.acceptedCount,
    };
  });
}
