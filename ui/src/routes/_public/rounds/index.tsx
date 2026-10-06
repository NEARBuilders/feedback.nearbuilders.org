import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  type SearchSchemaInput,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useMemo } from "react";
import { useApiClient } from "@/app";
import { EmptyState, Input, SegmentedToggle } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundsTable } from "@/components/rounds-table";
import { RouteError, RoutePending } from "@/components/route-states";
import { TopTesters } from "@/components/top-testers";
import { pageHead } from "@/lib/page-title";
import { roundEndorsementsQueryOptions, roundsQueryOptions } from "@/lib/queries/rounds";
import { oneOf, positiveInt } from "@/lib/search";

const STATUS_FILTERS = ["open", "closed"] as const;
type RoundStatusFilter = (typeof STATUS_FILTERS)[number];

interface RoundsSearch {
  status: RoundStatusFilter;
  q: string;
  page: number;
}

export function validateRoundsSearch(
  search: Partial<RoundsSearch> & SearchSchemaInput,
): RoundsSearch {
  return {
    status: oneOf(search.status, STATUS_FILTERS, "open"),
    q: typeof search.q === "string" ? search.q : "",
    page: positiveInt(search.page) ?? 1,
  };
}

const DEFAULT_SEARCH: RoundsSearch = { status: "open", q: "", page: 1 };

export const Route = createFileRoute("/_public/rounds/")({
  validateSearch: validateRoundsSearch,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(roundsQueryOptions(context.apiClient, deps.status)),
  head: () => pageHead("Rounds", "Browse feedback rounds and join one."),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: RoundsPage,
});

function RoundsPage() {
  const apiClient = useApiClient();
  const { status, q: query, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (next: Partial<RoundsSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...next }), replace: true });

  const { data: rounds } = useSuspenseQuery(roundsQueryOptions(apiClient, status));

  const roundIds = useMemo(() => rounds.map((round) => round.id).slice(0, 100), [rounds]);
  const { data: endorsements } = useQuery(roundEndorsementsQueryOptions(apiClient, roundIds));

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
          <PageHeader icon={MessageSquare} label="Feedback Rounds" title="Rounds" />

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedToggle
              value={status}
              onValueChange={(next) => setSearch({ status: next })}
              options={STATUS_FILTERS.map((value) => ({ value, label: value }))}
              ariaLabel="Round status filter"
            />
            <div className="relative max-w-sm flex-1 min-w-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setSearch({ q: e.target.value })}
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
          <RoundsTable
            rounds={filtered}
            endorsements={endorsements}
            page={page}
            onPageChange={(next) => setSearch({ page: next })}
          />
        )}
      </div>
    </PageContainer>
  );
}
