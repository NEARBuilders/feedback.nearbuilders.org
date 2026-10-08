import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, MessageSquare, PenLine } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, EmptyState } from "@/components";
import { ActionCard } from "@/components/action-card";
import { FeedbackList } from "@/components/feedback-list";
import { LoadMoreButton } from "@/components/load-more-button";
import { RoundRepoLinks } from "@/components/round-repo-links";
import { roundFeedbackQueryOptions } from "@/lib/queries/feedback";
import { acceptsFeedback } from "@/lib/round-deadline";
import { loadRound, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { roundIssuesUrl } from "@/lib/tester-workspace";

export const Route = createFileRoute("/_public/projects/$slug/$n/feedback")({
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    await context.queryClient.ensureInfiniteQueryData(
      roundFeedbackQueryOptions(context.apiClient, round.id),
    );
  },
  component: RoundFeedbackPage,
});

function RoundFeedbackPage() {
  const params = Route.useParams();
  const round = useRound(params);
  const apiClient = useApiClient();
  const viewer = useRoundViewer(round);
  const feedbackQuery = useSuspenseInfiniteQuery(roundFeedbackQueryOptions(apiClient, round.id));
  const entries = feedbackQuery.data.pages.flatMap((page) => page.items);
  const issues = roundIssuesUrl(round);
  const canReadAll = viewer.canManage || viewer.isAdmin;

  return (
    <div className="space-y-4">
      {(viewer.canPost || issues) && (
        <ActionCard>
          <p className="text-sm text-muted-foreground">
            {viewer.canPost
              ? "Write feedback in your workspace, next to the app you're testing."
              : "Bugs go to the project's GitHub issues."}
          </p>
          <div className="flex gap-2">
            <RoundRepoLinks round={round} />
            {viewer.canPost && (
              <Button asChild size="sm">
                <Link to="/projects/$slug/$n/submit" params={params}>
                  <PenLine className="h-3.5 w-3.5" />
                  write feedback
                </Link>
              </Button>
            )}
          </div>
        </ActionCard>
      )}

      {round.isPrivate && (
        <Card className="p-4" data-testid="private-feedback-note">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {canReadAll
                ? "This round is private: only your organization, platform admins and each author can read submissions."
                : `This round is private. ${round.feedbackCount ?? 0} ${
                    round.feedbackCount === 1 ? "submission has" : "submissions have"
                  } been posted, but you can only read your own.`}
            </span>
          </p>
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={
            round.isPrivate && !canReadAll && (round.feedbackCount ?? 0) > 0
              ? "You haven't posted any feedback here."
              : "No feedback yet."
          }
          className="min-h-[20vh]"
        />
      ) : (
        <FeedbackList
          roundId={round.id}
          entries={entries}
          currentAccountId={viewer.accountId}
          canDelete={acceptsFeedback(round)}
        />
      )}

      <LoadMoreButton query={feedbackQuery} />
    </div>
  );
}
