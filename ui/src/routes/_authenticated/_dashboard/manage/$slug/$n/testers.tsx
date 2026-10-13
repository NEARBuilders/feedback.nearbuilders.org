import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  type SearchSchemaInput,
  stripSearchParams,
  useNavigate,
} from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useState } from "react";
import { useApiClient } from "@/app";
import { Card, EmptyState, Input, SegmentedToggle } from "@/components";
import { FeedbackTesterList, FeedbackTesterPanel } from "@/components/feedback-testers";
import { filterTesters, TESTER_FILTERS, type TesterFilter } from "@/lib/feedback-testers";
import { feedbackTestersQueryOptions } from "@/lib/queries/feedback";
import { loadRound, useRound } from "@/lib/round-route";
import { oneOf } from "@/lib/search";
import { cn } from "@/lib/utils";

interface TestersSearch {
  status: TesterFilter;
  account?: string;
}

export function validateTestersSearch(
  search: Partial<TestersSearch> & SearchSchemaInput,
): TestersSearch {
  return {
    status: oneOf(search.status, TESTER_FILTERS, "unresolved"),
    account: typeof search.account === "string" && search.account ? search.account : undefined,
  };
}

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/testers")({
  validateSearch: validateTestersSearch,
  search: { middlewares: [stripSearchParams({ status: "unresolved" })] },
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    await context.queryClient.ensureQueryData(
      feedbackTestersQueryOptions(context.apiClient, round.id),
    );
  },
  component: TestersTab,
});

function TestersTab() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const round = useRound(params);
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: testers } = useSuspenseQuery(feedbackTestersQueryOptions(apiClient, round.id));
  const visible = filterTesters(testers, search.status, query);
  const openTester = testers.find((tester) => tester.accountId === search.account);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className={cn("space-y-3", openTester && "hidden lg:block")}>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedToggle
            value={search.status}
            onValueChange={(status) =>
              void navigate({
                to: "/manage/$slug/$n/testers",
                params,
                search: { ...search, status },
              })
            }
            options={TESTER_FILTERS.map((value) => ({ value, label: value }))}
            ariaLabel="Filter testers by status"
          />
          <span className="text-xs text-muted-foreground">
            {visible.length} of {testers.length}
          </span>
        </div>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search wallet or @telegram"
          aria-label="Search testers"
        />
        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title={testers.length === 0 ? "No feedback yet." : "Nobody here."}
            description={
              testers.length === 0
                ? "Testers show up here once they post feedback."
                : "No testers match these filters."
            }
            className="min-h-[30vh]"
          />
        ) : (
          <FeedbackTesterList
            testers={visible}
            openAccountId={search.account}
            params={params}
            filter={search.status}
          />
        )}
      </section>

      <section className="min-w-0">
        {openTester ? (
          <FeedbackTesterPanel
            key={openTester.accountId}
            roundId={round.id}
            params={params}
            tester={openTester}
            filter={search.status}
          />
        ) : (
          <Card className="hidden p-8 text-center text-sm text-muted-foreground lg:block">
            Pick a tester to read everything they sent.
          </Card>
        )}
      </section>
    </div>
  );
}
