import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { EmptyState, Input, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundsTable } from "@/components/rounds-table";
import { TopTesters } from "@/components/top-testers";
import { pageHead } from "@/lib/page-title";

type RoundStatusFilter = "open" | "closed";

export const Route = createFileRoute("/_public/feed/")({
  head: () => pageHead("Feed", "Browse feedback rounds and join one."),
  component: FeedPage,
});

function FeedPage() {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<RoundStatusFilter>("open");
  const [query, setQuery] = useState("");

  const { data: rounds = [], isLoading } = useQuery({
    queryKey: ["rounds", status],
    queryFn: () => apiClient.listRounds({ status }),
    staleTime: 30_000,
  });

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
    <PageContainer variant="wide">
      <div className="space-y-8">
        <div className="space-y-4">
          <PageHeader icon={MessageSquare} label="Feedback Rounds" title="Feed" />

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-card p-0.5">
              {(["open", "closed"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`h-8 px-3 text-sm font-medium rounded-[8px] transition-colors ${
                    status === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
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

        {isLoading ? (
          <div className="space-y-2" data-testid="rounds-loading">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
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
