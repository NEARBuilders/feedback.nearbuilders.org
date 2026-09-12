import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useApiClient } from "@/app";
import { Badge, Card, Input } from "@/components";
import { PageContainer } from "@/components/layout/page-container";

type RoundStatusFilter = "open" | "closed";

export const Route = createFileRoute("/_layout/_public/feed/")({
  head: () => ({
    meta: [
      { title: "Feed | Feedback Rounds" },
      { name: "description", content: "Browse feedback rounds and join one." },
    ],
  }),
  component: FeedPage,
});

const FORMAT_LABELS: Record<string, string> = {
  issues: "GitHub issues",
  written: "Written feedback",
  recorded: "Recorded session",
};

function FeedPage() {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<RoundStatusFilter>("open");
  const [query, setQuery] = useState("");

  const { data: rounds = [], isLoading } = useQuery({
    queryKey: ["rounds", status],
    queryFn: () => apiClient.listRounds({ status }),
    staleTime: 30_000,
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
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Feedback Rounds
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Feed</h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-[10px] border-2 border-outset border-border-strong bg-card p-0.5 shadow-sm">
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
        </header>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="p-6 space-y-4">
                <div className="h-5 w-3/4 rounded-[4px] animate-pulse bg-muted" />
                <div className="h-4 w-1/2 rounded-[4px] animate-pulse bg-muted" />
                <div className="h-10 w-full rounded-[12px] animate-pulse bg-muted" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center space-y-4 items-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">
              {rounds.length === 0 ? `No ${status} rounds yet.` : "No rounds match your search."}
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((round) => (
              <Link
                key={round.id}
                to="/feed/$roundId"
                params={{ roundId: round.id }}
                className="no-underline"
              >
                <Card className="p-6 space-y-4 hover:shadow-md h-full">
                  <div className="space-y-1">
                    <div className="text-lg font-semibold text-foreground">{round.title}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {round.projectSlug}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{round.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {round.formats.map((format) => (
                      <Badge key={format} variant="outline" className="text-xs">
                        {FORMAT_LABELS[format] ?? format}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
