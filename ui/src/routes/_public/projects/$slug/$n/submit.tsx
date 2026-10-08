import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, EmptyState, SectionHeader } from "@/components";
import { ActionCard } from "@/components/action-card";
import { FeedbackComposer } from "@/components/feedback-composer";
import { FeedbackList } from "@/components/feedback-list";
import { FeedbackNoteForm, FeedbackNoteThread } from "@/components/feedback-notes";
import { RouteError, RoutePending } from "@/components/route-states";
import { myFeedbackQueryOptions } from "@/lib/queries/feedback";
import { myFeedbackHref } from "@/lib/round-links";
import { loadRound, type RoundDetail, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { absoluteUrl, copyUrl } from "@/lib/share";

/**
 * A tester's own workspace for a round: compose a submission, then track what
 * happened to it. Lives on the round itself rather than a parallel /testing
 * URL, so a round has one address whoever is looking at it.
 */
export const Route = createFileRoute("/_public/projects/$slug/$n/submit")({
  // Only the round is prefetched: listMyFeedback needs a session, and this tab
  // is reachable (and renders a join prompt) while signed out.
  loader: ({ context, params }) => loadRound(context, params),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: SubmitFeedbackTab,
});

function SubmitFeedbackTab() {
  const params = Route.useParams();
  const round = useRound(params);
  const viewer = useRoundViewer(round);

  if (!viewer.canPost && !viewer.joined) {
    return (
      <ActionCard>
        <p className="text-sm text-muted-foreground">Join this round to give feedback.</p>
        <Button asChild size="sm">
          <Link to="/projects/$slug/$n" params={params}>
            back to the round
          </Link>
        </Button>
      </ActionCard>
    );
  }

  return (
    <div className="space-y-6">
      {viewer.canPost && <FeedbackComposer round={round} accountId={viewer.accountId} />}
      <MySubmissions round={round} accountId={viewer.accountId} />
    </div>
  );
}

function MySubmissions({ round, accountId }: { round: RoundDetail; accountId: string | null }) {
  const apiClient = useApiClient();
  const { data: mine } = useSuspenseQuery(myFeedbackQueryOptions(apiClient, round.id));
  const shareHref = accountId ? absoluteUrl(myFeedbackHref(round, accountId)) : null;

  return (
    <div className="space-y-3" data-testid="my-submissions">
      <SectionHeader
        title="My submissions"
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{mine.length}</span>
            {shareHref && (
              <Button
                variant="outline"
                size="sm"
                data-testid="share-my-feedback"
                onClick={() => void copyUrl(shareHref)}
              >
                <Link2 className="h-3.5 w-3.5" />
                share my feedback
              </Button>
            )}
          </div>
        }
      />
      {mine.length === 0 ? (
        <EmptyState title="Nothing submitted yet." className="min-h-[12vh]" />
      ) : (
        <FeedbackList
          roundId={round.id}
          entries={mine}
          currentAccountId={accountId}
          canDelete={round.status === "open"}
          renderFooter={(entry) => (
            <>
              <FeedbackNoteThread notes={entry.notes} />
              {entry.notes.some((note) => note.role === "owner") && (
                <FeedbackNoteForm
                  roundId={round.id}
                  feedbackId={entry.id}
                  placeholder="Reply to the round owner"
                  submitLabel="reply"
                />
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
