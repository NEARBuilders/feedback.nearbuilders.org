import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, type SearchSchemaInput, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { EmptyState, Input, SegmentedToggle } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundsTable } from "@/components/rounds-table";
import { RouteError, RoutePending } from "@/components/route-states";
import { TopTesters } from "@/components/top-testers";
import { pageHead } from "@/lib/page-title";
import { roundsQueryOptions } from "@/lib/queries/rounds";
import { oneOf } from "@/lib/search";

const STATUS_FILTERS = ["open", "closed"] as const;
type RoundStatusFilter = (typeof STATUS_FILTERS)[number];

export const Route = createFileRoute("/_public/feed/")({
  validateSearch: (
    search: { status?: RoundStatusFilter } & SearchSchemaInput,
  ): { status: RoundStatusFilter } => ({
    status: oneOf(search.status, STATUS_FILTERS, "open"),
  }),
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(roundsQueryOptions(context.apiClient, deps.status)),
  head: () => pageHead("Feed", "Browse feedback rounds and join one."),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: FeedPage,
});

function FeedPage() {
  const apiClient = useApiClient();
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setStatus = (next: RoundStatusFilter) => void navigate({ search: { status: next } });
  const [query, setQuery] = useState("");

  const { data: rounds } = useSuspenseQuery(roundsQueryOptions(apiClient, status));

  const roundIds = useMemo(() => rounds.map((round) => round.id).slice(0, 100), [rounds]);
  const { data: endorsements } = useQuery({
    queryKey: ["activity", "endorsements", roundIds],
    queryFn: () => apiClient.getRoundEndorsements({ roundIds }),
    enabled: roundIds.length > 0,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rounds;
    return rounds.filter((round) =>
      [round.title, round.description, round.projectSlug].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [rounds, query]);

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <div className="space-y-4">
          <PageHeader icon={MessageSquare} label="Feedback Rounds" title="Feed" />

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedToggle
              value={status}
              onValueChange={setStatus}
              options={STATUS_FILTERS.map((value) => ({ value, label: value }))}
              ariaLabel="Round status filter"
            />
            <div className="relative max-w-sm flex-1 min-w-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rounds"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <TopTesters />

        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={
              rounds.length === 0 ? `No ${status} rounds yet.` : "No rounds match your search."
            }
            className="min-h-[30vh]"
          />
        ) : (
          <RoundsTable rounds={filtered} endorsements={endorsements} />
        )}
      </div>
    </PageContainer>
  );
}
