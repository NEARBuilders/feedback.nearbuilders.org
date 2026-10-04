import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { EmptyState, Input, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { pageHead } from "@/lib/page-title";

type LeaderboardPeriod = "weekly" | "monthly" | "all-time";

const PERIODS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "all-time", label: "All time" },
];

export const Route = createFileRoute("/_public/leaderboard")({
  head: () =>
    pageHead(
      "Leaderboard",
      "Top testers by feedback activity, for this week, this month, and all time.",
    ),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const apiClient = useApiClient();
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [query, setQuery] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", "leaderboard", period, 50],
    queryFn: () => apiClient.getLeaderboard({ period, limit: 50 }),
    staleTime: 60_000,
  });

  const entries = data?.data ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => entry.actor.toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <PageContainer variant="wide">
      <div className="space-y-8">
        <div className="space-y-4">
          <PageHeader icon={Trophy} label="Top testers" title="Leaderboard" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`h-8 px-3 text-sm font-medium rounded-[8px] transition-colors ${
                    period === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative max-w-sm flex-1 min-w-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search testers"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2" data-testid="leaderboard-loading">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={Trophy}
            title="Couldn't load the leaderboard right now."
            className="min-h-[30vh]"
          />
        ) : data?.configured === false ? (
          <EmptyState
            icon={Trophy}
            title="Activity isn't connected."
            description="Standings for each period show up here once the activity gateway is configured."
            className="min-h-[30vh]"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title={
              entries.length === 0
                ? "No leaderboard activity yet for this period."
                : "No testers match your search."
            }
            className="min-h-[30vh]"
          />
        ) : (
          <LeaderboardTable entries={filtered} />
        )}
      </div>
    </PageContainer>
  );
}
