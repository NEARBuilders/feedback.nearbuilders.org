import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, ExternalLink, MessageSquare } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge, Card, EmptyState } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";
import { toActivityEventViews } from "@/lib/activity-events";
import { toBuilderRoundViews } from "@/lib/builder-rounds";

export const Route = createFileRoute("/_layout/_public/$accountId/")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { accountId } = Route.useParams();
  return (
    <div className="space-y-8">
      <BuilderFeedbackRounds accountId={accountId} />
      <BuilderActivityFeed accountId={accountId} />
    </div>
  );
}

/**
 * Cross-app "Recent activity" section, read from activity.nearbuilders.org's
 * `GET /v1/events?actor=<account>` via `GET /builders/{accountId}/activity`.
 * Shows everything the account has done across apps, not only feedback rounds.
 */
export function BuilderActivityFeed({ accountId }: { accountId: string }) {
  const apiClient = useApiClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["builders", accountId, "activity"],
    queryFn: () => apiClient.getBuilderActivity({ accountId }),
    staleTime: 30_000,
  });

  const events = toActivityEventViews(data ?? []);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Recent activity</h2>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Couldn't load activity right now.</p>
        </Card>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description={`No activity from ${accountId} on activity.nearbuilders.org.`}
          className="min-h-[20vh]"
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <Card className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="truncate text-sm font-medium text-foreground">
                    {event.summary}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{event.sourceLabel}</div>
                </div>
                {event.on && <span className="text-xs text-muted-foreground">{event.on}</span>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
