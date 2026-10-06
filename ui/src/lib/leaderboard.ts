export type LeaderboardPeriod = "weekly" | "monthly" | "all-time";

export const LEADERBOARD_PERIODS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "all-time", label: "All time" },
];

export const DEFAULT_LEADERBOARD_PERIOD: LeaderboardPeriod = "weekly";

export type LeaderboardMetric = "submissions" | "points";

export const LEADERBOARD_METRICS: Array<{ value: LeaderboardMetric; label: string }> = [
  { value: "submissions", label: "Submissions" },
  { value: "points", label: "Points" },
];

export const DEFAULT_LEADERBOARD_METRIC: LeaderboardMetric = "submissions";

export function isLeaderboardMetric(value: unknown): value is LeaderboardMetric {
  return LEADERBOARD_METRICS.some((metric) => metric.value === value);
}

export function isLeaderboardPeriod(value: unknown): value is LeaderboardPeriod {
  return LEADERBOARD_PERIODS.some((period) => period.value === value);
}

export function periodLabel(period: LeaderboardPeriod): string {
  return LEADERBOARD_PERIODS.find((entry) => entry.value === period)?.label ?? period;
}

export function submissionsLabel(count: number): string {
  return `${count} ${count === 1 ? "submission" : "submissions"}`;
}

export interface Standing {
  rank: number;
  actor: string;
  score: number;
  eventCount: number;
}

export const LEADERBOARD_PAGE_SIZE = 10;

export function filterStandings<T extends { actor: string }>(entries: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => entry.actor.toLowerCase().includes(needle));
}

export function paginate<T>(items: T[], page: number, pageSize = LEADERBOARD_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount };
}

export type LeaderboardState = "ready" | "empty" | "no-match" | "unconfigured" | "unreachable";

export function leaderboardState(
  board: { configured: boolean; available: boolean; data: unknown[] },
  visibleCount: number,
): LeaderboardState {
  if (!board.configured) return "unconfigured";
  if (!board.available) return "unreachable";
  if (board.data.length === 0) return "empty";
  if (visibleCount === 0) return "no-match";
  return "ready";
}
