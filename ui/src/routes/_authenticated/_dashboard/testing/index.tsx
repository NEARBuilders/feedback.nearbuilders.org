import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, ExternalLink, PenLine, Search } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, EmptyState, SectionHeader } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { roundParams } from "@/lib/round-links";
import {
  feedbackPostedLabel,
  groupWorkspaceRounds,
  issuesUrl,
  nextAction,
  type WorkspaceRound,
} from "@/lib/tester-workspace";
import { useNearAccountStatus } from "@/lib/use-near-account";

export const Route = createFileRoute("/_authenticated/_dashboard/testing/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(joinedRoundsQueryOptions(context.apiClient)),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  head: () => pageHead("Testing", "The rounds you're testing and what needs your feedback."),
  component: TestingPage,
});

const SECTIONS = [
  { key: "needsFeedback", title: "Needs your feedback" },
  { key: "submitted", title: "Submitted" },
  { key: "closed", title: "Closed" },
] as const;

function TestingPage() {
  const apiClient = useApiClient();
  const { accountId, isDetecting } = useNearAccountStatus();
  const { data: joined } = useSuspenseQuery(joinedRoundsQueryOptions(apiClient));
  const groups = groupWorkspaceRounds(joined);

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={ClipboardCheck}
          label="Testing"
          title="Tester workspace"
          actions={
            <Button asChild variant="outline">
              <Link to="/rounds">
                <Search className="h-4 w-4" />
                browse rounds
              </Link>
            </Button>
          }
        />

        {!accountId && !isDetecting ? (
          <Card className="p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              Link a NEAR account to see the rounds you've joined.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/auth-methods">Link a NEAR account</Link>
            </Button>
          </Card>
        ) : joined.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="You haven't joined any rounds yet."
            className="min-h-[30vh]"
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/rounds">Browse open rounds</Link>
              </Button>
            }
          />
        ) : (
          SECTIONS.map(
            ({ key, title }) =>
              groups[key].length > 0 && (
                <section key={key} className="space-y-3" data-testid={`tester-${key}`}>
                  <SectionHeader
                    title={title}
                    action={
                      <span className="text-sm text-muted-foreground">{groups[key].length}</span>
                    }
                  />
                  <ul className="space-y-2">
                    {groups[key].map((round) => (
                      <li key={round.roundId}>
                        <TesterRoundCard round={round} />
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )
        )}
      </div>
    </PageContainer>
  );
}

function TesterRoundCard({ round }: { round: WorkspaceRound }) {
  const action = nextAction(round);
  const issues = issuesUrl(round.repoUrl);

  return (
    <Card className="p-4" data-testid="tester-round">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <Link
            to="/projects/$slug/$n/submit"
            params={roundParams(round)}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {round.roundTitle}
          </Link>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{round.projectSlug}</span> ·{" "}
            {feedbackPostedLabel(round.myFeedbackCount)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RoundStatusBadge status={round.status} />
          {action.kind === "file-issues" && issues ? (
            <Button asChild size="sm" variant="outline">
              <a href={issues} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                {action.label}
              </a>
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              variant={action.kind === "give-feedback" ? "default" : "outline"}
            >
              <Link to="/projects/$slug/$n/submit" params={roundParams(round)}>
                <PenLine className="h-3.5 w-3.5" />
                {action.label}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
