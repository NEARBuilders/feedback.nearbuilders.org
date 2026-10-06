import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, MessageSquare, PenLine } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, EmptyState } from "@/components";
import { ActionCard } from "@/components/action-card";
import { FeedbackList } from "@/components/feedback-list";
import { roundFeedbackQueryOptions } from "@/lib/queries/feedback";
import { loadRound, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { issuesUrl } from "@/lib/tester-workspace";

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
  const issues = round.formats.includes("issues") ? issuesUrl(round.repoUrl) : null;

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
            {issues && (
              <Button asChild size="sm" variant="outline">
                <a href={issues} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  file an issue
                </a>
              </Button>
            )}
            {viewer.canPost && (
              <Button asChild size="sm">
                <Link to="/testing/$slug/$n" params={params}>
                  <PenLine className="h-3.5 w-3.5" />
                  write feedback
                </Link>
              </Button>
            )}
          </div>
        </ActionCard>
      )}

      {entries.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback yet." className="min-h-[20vh]" />
      ) : (
        <FeedbackList
          roundId={round.id}
          entries={entries}
          currentAccountId={viewer.accountId}
          canDelete={round.status === "open"}
        />
      )}

      {feedbackQuery.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void feedbackQuery.fetchNextPage()}
          disabled={feedbackQuery.isFetchingNextPage}
        >
          {feedbackQuery.isFetchingNextPage ? "loading..." : "load more"}
        </Button>
      )}
    </div>
  );
}
