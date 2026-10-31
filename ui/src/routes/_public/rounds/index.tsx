import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  redirect,
  type SearchSchemaInput,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useMemo } from "react";
import { type Organization, sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { EmptyState, Input, SegmentedToggle } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ROUNDS_PAGE_SIZE, RoundsTable } from "@/components/rounds-table";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { roundEndorsementsQueryOptions, roundsQueryOptions } from "@/lib/queries/rounds";
import { oneOf, positiveInt } from "@/lib/search";

const STATUS_FILTERS = ["open", "closed"] as const;
type RoundStatusFilter = (typeof STATUS_FILTERS)[number];

interface RoundsSearch {
  status: RoundStatusFilter;
  q: string;
  /** Only rounds created under this organization; empty means all. */
  org: string;
  page: number;
}

export function validateRoundsSearch(
  search: Partial<RoundsSearch> & SearchSchemaInput,
): RoundsSearch {
  return {
    status: oneOf(search.status, STATUS_FILTERS, "open"),
    q: typeof search.q === "string" ? search.q : "",
    org: typeof search.org === "string" ? search.org : "",
    page: positiveInt(search.page) ?? 1,
  };
}

const DEFAULT_SEARCH: RoundsSearch = { status: "open", q: "", org: "", page: 1 };

function roundsMatchingQuery<
  T extends {
    title: string;
    description: string;
    projectSlug: string;
    identity: { title?: string | null; domain?: string | null } | null;
  },
>(rounds: T[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return rounds;
  return rounds.filter((round) =>
    [
      round.title,
      round.description,
      round.projectSlug,
      round.identity?.title ?? "",
      round.identity?.domain ?? "",
    ].some((field) => field.toLowerCase().includes(q)),
  );
}

function clampRoundsPage(itemCount: number, page: number) {
  const pageCount = Math.max(1, Math.ceil(itemCount / ROUNDS_PAGE_SIZE));
  return Math.min(page, pageCount);
}

export const Route = createFileRoute("/_public/rounds/")({
  validateSearch: validateRoundsSearch,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
  beforeLoad: async ({ context, search }) => {
    const rounds = await context.queryClient.ensureQueryData(
      roundsQueryOptions(context.apiClient, search.status, search.org || undefined),
    );
    const matched = roundsMatchingQuery(rounds, search.q);
    if (matched.length === 0) return;
    const safePage = clampRoundsPage(matched.length, search.page);
    if (safePage === search.page) return;
    throw redirect({
      to: "/rounds",
      search: { ...search, page: safePage },
      replace: true,
    });
  },
  loaderDeps: ({ search }) => ({ status: search.status, org: search.org }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      roundsQueryOptions(context.apiClient, deps.status, deps.org || undefined),
    ),
  head: () => pageHead("Rounds", "Products looking for testers. Join a round and report back."),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: RoundsPage,
});

function RoundsPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { status, q: query, org, page } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (next: Partial<RoundsSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, page: 1, ...next }), replace: true });

  const { data: rounds } = useSuspenseQuery(
    roundsQueryOptions(apiClient, status, org || undefined),
  );

  const session = useQuery(sessionQueryOptions(auth));
  const { data: organizations = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data } = await auth.organization.list();
      return (data || []) as Organization[];
    },
    staleTime: 30 * 1000,
    enabled: !!session.data?.user,
  });

  const roundIds = useMemo(() => rounds.map((round) => round.id).slice(0, 100), [rounds]);
  const { data: endorsements } = useQuery(roundEndorsementsQueryOptions(apiClient, roundIds));

  const filtered = useMemo(() => roundsMatchingQuery(rounds, query), [rounds, query]);

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <div className="space-y-4">
          <PageHeader
            icon={MessageSquare}
            label="Feedback Rounds"
            title="Rounds"
            description="Products looking for testers right now. Join one, try it, report back."
          />

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedToggle
              value={status}
              onValueChange={(next) => setSearch({ status: next })}
              options={STATUS_FILTERS.map((value) => ({ value, label: value }))}
              ariaLabel="Round status filter"
            />
            {organizations.length > 0 && (
              <select
                value={org}
                onChange={(e) => setSearch({ org: e.target.value })}
                aria-label="Organization filter"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">all organizations</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            )}
            <div className="relative max-w-sm flex-1 min-w-[12rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setSearch({ q: e.target.value })}
                placeholder="Search rounds and projects"
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={
              rounds.length === 0
                ? org
                  ? `No ${status} rounds for this organization.`
                  : `No ${status} rounds yet.`
                : "No rounds match your search."
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
