import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { Button, EmptyState, Input, SegmentedToggle, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LeaderboardTable } from "@/components/leaderboard-table";
import {
  DEFAULT_LEADERBOARD_PERIOD,
  filterStandings,
  isLeaderboardPeriod,
  LEADERBOARD_PERIODS,
  type LeaderboardPeriod,
  leaderboardState,
  paginate,
  periodLabel,
} from "@/lib/leaderboard";
import { pageHead } from "@/lib/page-title";
import { useNearAccountStatus } from "@/lib/use-near-account";

const LEADERBOARD_LIMIT = 50;

export const Route = createFileRoute("/_public/leaderboard")({
  validateSearch: (search: Record<string, unknown>): { period: LeaderboardPeriod } => ({
    period: isLeaderboardPeriod(search.period) ? search.period : DEFAULT_LEADERBOARD_PERIOD,
  }),
  head: () =>
    pageHead(
      "Leaderboard",
      "Top testers by feedback activity, for this week, this month, and all time.",
    ),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { period } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const apiClient = useApiClient();
  const { accountId } = useNearAccountStatus();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["leaderboard", period, LEADERBOARD_LIMIT],
    queryFn: () => apiClient.getLeaderboard({ period, limit: LEADERBOARD_LIMIT }),
    staleTime: 60_000,
  });

  useEffect(() => {
    setPage(1);
  }, [period, query]);

  const filtered = useMemo(() => filterStandings(data?.data ?? [], query), [data, query]);
  const paged = paginate(filtered, page);
  const state = data ? leaderboardState(data, filtered.length) : null;

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <PageHeader
          icon={Trophy}
          label="Leaderboard"
          title="Top testers"
          description="Builders ranked by the credit they've earned across feedback rounds."
        />

        <div className="flex flex-wrap items-center gap-3">
          <SegmentedToggle
            value={period}
            onValueChange={(next) =>
              void navigate({ search: (prev) => ({ ...prev, period: next }) })
            }
            options={LEADERBOARD_PERIODS}
            ariaLabel="Leaderboard period"
          />
          <div className="relative min-w-[12rem] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search testers"
              aria-label="Search testers"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2" data-testid="leaderboard-loading">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={n} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <EmptyState
            icon={Trophy}
            title="Couldn't load the leaderboard."
            className="min-h-[30vh]"
            action={
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : state === "unconfigured" ? (
          <EmptyState
            icon={Trophy}
            title="Activity isn't connected."
            description="Standings show up here once the activity gateway is configured."
            className="min-h-[30vh]"
          />
        ) : state === "unreachable" ? (
          <EmptyState
            icon={Trophy}
            title="The leaderboard is unavailable right now."
            description="The activity service didn't respond. Try again in a moment."
            className="min-h-[30vh]"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                Try again
              </Button>
            }
          />
        ) : state === "empty" ? (
          <EmptyState
            icon={Trophy}
            title={`No leaderboard activity yet for ${periodLabel(period).toLowerCase()}.`}
            className="min-h-[30vh]"
          />
        ) : state === "no-match" ? (
          <EmptyState
            icon={Trophy}
            title="No testers match your search."
            className="min-h-[30vh]"
          />
        ) : (
          <div className="space-y-3">
            <LeaderboardTable entries={paged.items} currentAccountId={accountId || null} />
            {paged.pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  Page {paged.page} of {paged.pageCount}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(paged.page - 1)}
                    disabled={paged.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(paged.page + 1)}
                    disabled={paged.page >= paged.pageCount}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
