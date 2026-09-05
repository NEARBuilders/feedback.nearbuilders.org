import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_layout/feedback/$roundId")({
  head: ({ params }) => ({
    meta: [
      { title: "Feedback Round" },
      { name: "description", content: `Detail view for round ${params.roundId}.` },
    ],
  }),
  component: RoundDetailPage,
});

const FORMAT_LABELS: Record<string, string> = {
  issues: "GitHub issues",
  written: "Written feedback",
  recorded: "Recorded session",
};

function RoundDetailPage() {
  const { roundId } = Route.useParams();
  const apiClient = useApiClient();
  const router = useRouter();
  const canGoBack = router.history.canGoBack?.() ?? false;

  const roundQuery = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => apiClient.getRound({ id: roundId }),
  });

  const round = roundQuery.data;

  if (roundQuery.isLoading) {
    return (
      <PageContainer variant="narrow">
        <div className="space-y-3 py-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!round) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <p className="text-base font-semibold text-foreground">Round not found.</p>
        <a href="/feedback" className="text-sm text-muted-foreground underline">
          back to feedback rounds
        </a>
      </div>
    );
  }

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={() => router.history.back()}
              className="flex items-center justify-center w-8 h-8 border-2 border-outset border-border-strong bg-card shadow-sm rounded-[10px] hover:bg-muted"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <Badge variant={round.status === "open" ? "secondary" : "outline"}>{round.status}</Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{round.title}</h1>
          <p className="text-xs font-mono text-muted-foreground">{round.projectSlug}</p>
        </div>

        <p className="text-sm text-foreground whitespace-pre-wrap">{round.description}</p>

        <div className="flex flex-wrap gap-1.5">
          {round.formats.map((format) => (
            <Badge key={format} variant="outline" className="text-xs">
              {FORMAT_LABELS[format] ?? format}
            </Badge>
          ))}
        </div>

        {round.repoUrl && (
          <a
            href={round.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-foreground underline"
          >
            {round.repoUrl}
          </a>
        )}
      </div>
    </PageContainer>
  );
}
