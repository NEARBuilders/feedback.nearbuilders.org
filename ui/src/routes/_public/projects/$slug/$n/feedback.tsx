import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, type SearchSchemaInput, useNavigate } from "@tanstack/react-router";
import { Lock, MessageSquare, PenLine, X } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, EmptyState } from "@/components";
import { ActionCard } from "@/components/action-card";
import { FeedbackList } from "@/components/feedback-list";
import { LoadMoreButton } from "@/components/load-more-button";
import { RoundRepoLinks } from "@/components/round-repo-links";
import { roundFeedbackQueryOptions } from "@/lib/queries/feedback";
import { loadRound, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { roundIssuesUrl } from "@/lib/tester-workspace";

export function validateFeedbackSearch(search: Partial<{ author?: string }> & SearchSchemaInput): {
  author?: string;
} {
  return {
    author: typeof search.author === "string" && search.author ? search.author : undefined,
  };
}

export function feedbackEmptyTitle({
  author,
  isPrivate,
  canReadAll,
  viewerAccountId,
  feedbackCount,
}: {
  author: string | undefined;
  isPrivate: boolean;
  canReadAll: boolean;
  viewerAccountId: string | null;
  feedbackCount: number;
}): string {
  if (author) {
    if (author === viewerAccountId) {
      return "You haven't posted any feedback here.";
    }
    if (isPrivate && !canReadAll) {
      return "This feedback is only visible to the round organizers and its author.";
    }
    return `No feedback by ${author} yet.`;
  }
  if (isPrivate && !canReadAll && feedbackCount > 0) {
    return "You haven't posted any feedback here.";
  }
  return "No feedback yet.";
}

export const Route = createFileRoute("/_public/projects/$slug/$n/feedback")({
  validateSearch: validateFeedbackSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, params, deps }) => {
    const round = await loadRound(context, params);
    await context.queryClient.ensureInfiniteQueryData(
      roundFeedbackQueryOptions(context.apiClient, round.id, { author: deps.author }),
    );
  },
  component: RoundFeedbackPage,
});

function RoundFeedbackPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const round = useRound(params);
  const apiClient = useApiClient();
  const viewer = useRoundViewer(round);
  const navigate = useNavigate();
  const feedbackQuery = useSuspenseInfiniteQuery(
    roundFeedbackQueryOptions(apiClient, round.id, { author: search.author }),
  );
  const entries = feedbackQuery.data.pages.flatMap((page) => page.items);
  const issues = roundIssuesUrl(round);
  const canReadAll = viewer.canManage || viewer.isAdmin;
  const clearAuthor = () =>
    void navigate({ to: "/projects/$slug/$n/feedback", params, search: {} });

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

      {search.author && (
        <div className="flex items-center gap-2" data-testid="author-filter">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAuthor}
            aria-label="Clear author filter"
          >
            feedback by <span className="font-mono">{search.author}</span>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={feedbackEmptyTitle({
            author: search.author,
            isPrivate: round.isPrivate,
            canReadAll,
            viewerAccountId: viewer.accountId,
            feedbackCount: round.feedbackCount ?? 0,
          })}
          className="min-h-[20vh]"
        />
      ) : (
        <FeedbackList
          roundId={round.id}
          entries={entries}
          currentAccountId={viewer.accountId}
          canDelete={round.status === "open"}
        />
      )}

      <LoadMoreButton query={feedbackQuery} />
    </div>
  );
}
