import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "@/app";
import { Badge, Card } from "@/components";
import {
  DEFAULT_LEADERBOARD_PERIOD,
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
  submissionsLabel,
} from "@/lib/leaderboard";

/**
 * "Top testers" leaderboard, backed by activity.nearbuilders.org's
 * `GET /v1/leaderboard`, scoped server-side to this app's feedback.posted events.
 */
export function TopTesters() {
  const apiClient = useApiClient();
  const [period, setPeriod] = useState<LeaderboardPeriod>(DEFAULT_LEADERBOARD_PERIOD);

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
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          {LEADERBOARD_PERIODS.map(({ value, label }) => (
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
      ) : !data?.configured ? (
        <p className="text-sm text-muted-foreground">
          The leaderboard isn't connected to activity yet.
        </p>
      ) : !data.available ? (
        <p className="text-sm text-muted-foreground">The leaderboard is unavailable right now.</p>
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
                <Link
                  to="/$accountId"
                  params={{ accountId: entry.actor }}
                  className="truncate text-sm font-medium text-foreground hover:underline"
                >
                  {entry.actor}
                </Link>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {submissionsLabel(entry.eventCount)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <Link
        to="/leaderboard"
        search={{ period }}
        className="inline-block text-xs text-muted-foreground underline hover:text-foreground"
      >
        View full leaderboard
      </Link>
    </Card>
  );
}
