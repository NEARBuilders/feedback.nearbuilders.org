import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ExternalLink, MessageSquare, Trophy } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge, Card, EmptyState, Skeleton } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { ListRow } from "@/components/list-row";
import { toActivityEventViews } from "@/lib/activity-events";
import { toBuilderRoundViews } from "@/lib/builder-rounds";
import { contributionsLabel } from "@/lib/leaderboard";

export const Route = createFileRoute("/_public/$accountId/")({
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const { accountId } = Route.useParams();
  return (
    <div className="space-y-8">
      <BuilderStanding accountId={accountId} />
      <BuilderFeedbackRounds accountId={accountId} />
      <BuilderActivityFeed accountId={accountId} />
    </div>
  );
}

/**
 * All-time standing read from activity, which owns scoring for this app.
 * Hidden for builders who have not scored yet, so untested profiles stay clean.
 */
export function BuilderStanding({ accountId }: { accountId: string }) {
  const apiClient = useApiClient();

  const { data, isLoading } = useQuery({
    queryKey: ["builders", accountId, "standing"],
    queryFn: () => apiClient.getBuilderStanding({ accountId }),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!data) return null;

  return (
    <section className="space-y-4" data-testid="builder-standing">
      <SectionHeader title="Earned credit" />
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Trophy className="h-5 w-5" />
              {data.score}
            </div>
            <p className="text-sm text-muted-foreground">
              {contributionsLabel(data.eventCount)} across feedback rounds
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">rank #{data.rank}</Badge>
            <Link
              to="/leaderboard"
              search={{ period: "all-time" }}
              className="text-sm text-foreground underline"
            >
              View leaderboard
            </Link>
          </div>
        </div>
      </Card>
    </section>
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
      <SectionHeader title="Recent activity" />

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
              <ListRow
                title={event.summary}
                subtitle={event.sourceLabel}
                trailing={
                  event.on && <span className="text-xs text-muted-foreground">{event.on}</span>
                }
              />
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
      <SectionHeader title="Feedback rounds" />

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
              <ListRow
                title={round.roundTitle}
                subtitle={<span className="font-mono">{round.projectSlug}</span>}
                trailing={
                  round.contributedMeaningfully && (
                    <Badge variant="secondary" className="text-[10px]">
                      credited
                    </Badge>
                  )
                }
              >
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
              </ListRow>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
