import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ClipboardCheck, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { useApiClient } from "@/app";
import { Badge, Button, Card, EmptyState, Markdown, SectionHeader } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { myProjectsQueryOptions } from "@/lib/queries/projects";
import {
  awaitingFeedback,
  feedbackPostedLabel,
  issuesUrl,
  nextAction,
  sortWorkspaceRounds,
  summarizeWorkspace,
  type WorkspaceRound,
} from "@/lib/tester-workspace";
import { useNearAccountStatus } from "@/lib/use-near-account";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  open: "secondary",
  closed: "outline",
  rejected: "destructive",
};

export const Route = createFileRoute("/_authenticated/_dashboard/testing")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(myProjectsQueryOptions(context.apiClient));
    return context.queryClient.ensureQueryData(joinedRoundsQueryOptions(context.apiClient));
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  head: () => pageHead("Testing", "The rounds you're testing and what needs your feedback."),
  component: TesterWorkspacePage,
});

function TesterWorkspacePage() {
  const apiClient = useApiClient();
  const { accountId, isDetecting } = useNearAccountStatus();

  const { data: joined } = useSuspenseQuery(joinedRoundsQueryOptions(apiClient));
  const ownedQuery = useQuery(myProjectsQueryOptions(apiClient));

  const rounds = useMemo(() => sortWorkspaceRounds(joined), [joined]);
  const summary = summarizeWorkspace(rounds);
  const ownedRounds = useMemo(
    () =>
      (ownedQuery.data ?? []).flatMap((project) =>
        project.rounds.map((round) => ({ ...round, projectSlug: project.slug })),
      ),
    [ownedQuery.data],
  );

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <PageHeader
          icon={ClipboardCheck}
          label="Testing"
          title="Tester workspace"
          description="The rounds you've joined and what each one needs from you."
          actions={
            <Button asChild variant="outline">
              <Link to="/feed" preload="intent">
                browse rounds
              </Link>
            </Button>
          }
        />

        {!accountId && !isDetecting ? (
          <Card className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Link a NEAR account to see the rounds you've joined as a tester.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/auth-methods">link a NEAR account</Link>
            </Button>
          </Card>
        ) : (
          <section className="space-y-3" data-testid="tester-rounds">
            <SectionHeader
              title="Rounds you're testing"
              action={
                summary.total > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {summary.awaitingFeedback} need feedback · {summary.open} open · {summary.total}{" "}
                    total
                  </span>
                ) : undefined
              }
            />
            {rounds.length === 0 ? (
              <EmptyState
                title="You haven't joined any rounds yet."
                description="Browse open rounds in the feed and join one to start testing."
                className="min-h-[30vh]"
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/feed">browse open rounds</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {rounds.map((round) => (
                  <li key={round.roundId}>
                    <TesterRoundCard round={round} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {ownedRounds.length > 0 && (
          <section className="space-y-3" data-testid="owned-rounds">
            <SectionHeader title="Rounds you run" />
            <ul className="space-y-2">
              {ownedRounds.map((round) => (
                <li key={round.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          to="/feed/$roundId"
                          params={{ roundId: round.id }}
                          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          #{round.projectRoundNumber} {round.title}
                        </Link>
                        <p className="text-xs font-mono text-muted-foreground">
                          {round.projectSlug}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">owner</Badge>
                        <Badge variant={STATUS_BADGE_VARIANT[round.status] ?? "outline"}>
                          {round.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageContainer>
  );
}

function TesterRoundCard({ round }: { round: WorkspaceRound }) {
  const action = nextAction(round);
  const needsFeedback = awaitingFeedback(round);
  const hasReadme = round.readme.trim().length > 0;
  const issues = issuesUrl(round.repoUrl);

  return (
    <Card
      className={`p-4 space-y-3 ${needsFeedback ? "border-foreground/30" : ""}`}
      data-testid="tester-round"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Link
            to="/feed/$roundId"
            params={{ roundId: round.roundId }}
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          >
            {round.roundTitle}
          </Link>
          <p className="text-xs font-mono text-muted-foreground">{round.projectSlug}</p>
        </div>
        <div className="flex items-center gap-2">
          {needsFeedback && <Badge variant="default">needs your feedback</Badge>}
          <Badge variant={STATUS_BADGE_VARIANT[round.status] ?? "outline"}>{round.status}</Badge>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {feedbackPostedLabel(round.myFeedbackCount)} · {round.participantCount}{" "}
        {round.participantCount === 1 ? "builder" : "builders"}
      </p>

      {hasReadme ? (
        <details open={needsFeedback} className="group rounded-md border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground">
            Readme from the round owner
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border px-3 py-3">
            <Markdown content={round.readme} />
          </div>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">
          The round owner hasn't written a readme for testers yet.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {action.kind === "file-issues" && issues ? (
          <Button asChild size="sm">
            <a href={issues} target="_blank" rel="noopener noreferrer">
              {action.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button asChild size="sm" variant={needsFeedback ? "default" : "outline"}>
            <Link
              to="/feed/$roundId"
              params={{ roundId: round.roundId }}
              hash={action.kind === "view-round" ? undefined : "feedback"}
            >
              {action.label}
            </Link>
          </Button>
        )}
        {action.kind !== "view-round" && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/feed/$roundId" params={{ roundId: round.roundId }}>
              Open round
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
