import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "@/app";
import { Badge, Card } from "@/components";

type LeaderboardPeriod = "weekly" | "monthly" | "all-time";

const PERIODS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "all-time", label: "All time" },
];

/**
 * "Top testers" leaderboard, backed by activity.nearbuilders.org's
 * `GET /v1/leaderboard`, scoped server-side to this app's feedback.posted events.
 */
export function TopTesters() {
  const apiClient = useApiClient();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  const { data, isLoading } = useQuery({
    queryKey: ["activity", "leaderboard", period],
    queryFn: () => apiClient.getLeaderboard({ period, limit: 10 }),
    staleTime: 60_000,
  });

  const entries = data?.data ?? [];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Trophy className="h-4 w-4" />
          Top testers
        </div>
        <div className="inline-flex rounded-[10px] border-2 border-outset border-border-strong bg-card p-0.5 shadow-sm">
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`h-7 px-2.5 text-xs font-medium rounded-[8px] transition-colors ${
                period === value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-8 w-full rounded-[8px] animate-pulse bg-muted" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leaderboard activity yet for this period.
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.actor}
              className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  #{entry.rank}
                </Badge>
                <span className="truncate text-sm font-medium text-foreground">{entry.actor}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {entry.eventCount} {entry.eventCount === 1 ? "submission" : "submissions"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
