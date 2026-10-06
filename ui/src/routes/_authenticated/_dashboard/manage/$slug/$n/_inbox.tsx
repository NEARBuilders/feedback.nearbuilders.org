import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  type SearchSchemaInput,
  stripSearchParams,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Inbox, X } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, EmptyState, SegmentedToggle } from "@/components";
import { FeedbackInbox } from "@/components/feedback-inbox";
import {
  type FeedbackFilters,
  type FeedbackStatus,
  roundFeedbackQueryOptions,
} from "@/lib/queries/feedback";
import { loadRound, useRound } from "@/lib/round-route";
import { oneOf } from "@/lib/search";
import { cn } from "@/lib/utils";

const STATUS_FILTERS = ["unresolved", "resolved", "dismissed", "all"] as const;

export interface InboxSearch {
  status: (typeof STATUS_FILTERS)[number];
  author?: string;
}

export function validateInboxSearch(search: Partial<InboxSearch> & SearchSchemaInput): InboxSearch {
  return {
    status: oneOf(search.status, STATUS_FILTERS, "unresolved"),
    author: typeof search.author === "string" && search.author ? search.author : undefined,
  };
}

export function inboxFilters({ status, author }: InboxSearch): FeedbackFilters {
  return { status: status === "all" ? undefined : (status as FeedbackStatus), author };
}

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/_inbox")({
  validateSearch: validateInboxSearch,
  search: { middlewares: [stripSearchParams({ status: "unresolved" })] },
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const round = await loadRound(context, params);
    await context.queryClient.ensureInfiniteQueryData(
      roundFeedbackQueryOptions(context.apiClient, round.id, inboxFilters(deps)),
    );
  },
  component: InboxLayout,
});

function InboxLayout() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const round = useRound(params);
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const { feedbackId } = useParams({ strict: false });

  const feedbackQuery = useSuspenseInfiniteQuery(
    roundFeedbackQueryOptions(apiClient, round.id, inboxFilters(search)),
  );
  const entries = feedbackQuery.data.pages.flatMap((page) => page.items);
  const setSearch = (next: Partial<InboxSearch>) =>
    void navigate({ to: "/manage/$slug/$n", params, search: { ...search, ...next } });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className={cn("space-y-3", feedbackId && "hidden lg:block")}>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle
            value={search.status}
            onValueChange={(status) => setSearch({ status })}
            options={STATUS_FILTERS.map((value) => ({ value, label: value }))}
            ariaLabel="Filter feedback by status"
          />
          {search.author && (
            <Button variant="outline" size="sm" onClick={() => setSearch({ author: undefined })}>
              <span className="font-mono">{search.author}</span>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={search.status === "unresolved" ? "Inbox zero." : "Nothing here."}
            description="No feedback matches these filters."
            className="min-h-[30vh]"
          />
        ) : (
          <FeedbackInbox
            roundId={round.id}
            params={params}
            entries={entries}
            openId={feedbackId}
            footer={
              feedbackQuery.hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void feedbackQuery.fetchNextPage()}
                  disabled={feedbackQuery.isFetchingNextPage}
                >
                  {feedbackQuery.isFetchingNextPage ? "loading..." : "load more"}
                </Button>
              )
            }
          />
        )}
      </section>

      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
