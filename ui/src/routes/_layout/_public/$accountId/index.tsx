import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, MessageSquare } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge, Card, EmptyState } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";
import { toBuilderRoundViews } from "@/lib/builder-rounds";

export const Route = createFileRoute("/_layout/_public/$accountId/")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { accountId } = Route.useParams();
  return <BuilderFeedbackRounds accountId={accountId} />;
}

/**
 * "Feedback rounds" profile section. Renders the credited rounds returned by
 * `GET /builders/{accountId}/rounds`; empty-safe when the builder has none.
 * The `nearbuilders.org` profile embeds this same section.
 */
export function BuilderFeedbackRounds({ accountId }: { accountId: string }) {
  const apiClient = useApiClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["builders", accountId, "rounds"],
    queryFn: () => apiClient.getBuilderRounds({ accountId }),
    staleTime: 30_000,
  });

  const rounds = toBuilderRoundViews(data ?? []);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Feedback rounds</h2>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Couldn't load feedback rounds right now.</p>
        </Card>
      ) : rounds.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback rounds yet"
          description={`${accountId} hasn't been credited on a closed feedback round.`}
          className="min-h-[30vh]"
        />
      ) : (
        <ul className="space-y-3">
          {rounds.map((round) => (
            <li key={round.roundId}>
              <Card className="p-5 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-base font-semibold text-foreground">
                      {round.roundTitle}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {round.projectSlug}
                    </div>
                  </div>
                  {round.contributedMeaningfully && (
                    <Badge variant="secondary" className="text-[10px]">
                      credited
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Closed {round.closedOn}</span>
                  {round.submissionsLabel && <span>· {round.submissionsLabel}</span>}
                  {round.issuesUrl && (
                    <a
                      href={round.issuesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-foreground hover:underline"
                    >
                      Issues on GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {round.summary && <p className="text-sm text-foreground">{round.summary}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
