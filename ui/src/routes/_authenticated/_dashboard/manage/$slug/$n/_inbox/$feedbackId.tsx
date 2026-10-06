import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Filter } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { FeedbackContent } from "@/components/feedback-content";
import { FeedbackNoteForm, FeedbackNoteThread } from "@/components/feedback-notes";
import { FeedbackStatusActions } from "@/components/feedback-status-actions";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { RouteNotFound } from "@/components/route-states";
import { feedbackItemQueryOptions } from "@/lib/queries/feedback";
import { orNotFound } from "@/lib/queries/not-found";
import { loadRound, useRound } from "@/lib/round-route";
import { useSetFeedbackStatus } from "@/lib/use-feedback-status";

export const Route = createFileRoute(
  "/_authenticated/_dashboard/manage/$slug/$n/_inbox/$feedbackId",
)({
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    await orNotFound(
      context.queryClient.ensureQueryData(
        feedbackItemQueryOptions(context.apiClient, round.id, params.feedbackId),
      ),
    );
  },
  notFoundComponent: () => <RouteNotFound title="Feedback not found." backTo="/manage" />,
  component: FeedbackDetailPane,
});

function FeedbackDetailPane() {
  const { feedbackId, ...params } = Route.useParams();
  const inboxSearch = useSearch({ from: "/_authenticated/_dashboard/manage/$slug/$n/_inbox" });
  const round = useRound(params);
  const apiClient = useApiClient();
  const { data: feedback } = useSuspenseQuery(
    feedbackItemQueryOptions(apiClient, round.id, feedbackId),
  );
  const statusMutation = useSetFeedbackStatus(round.id);

  return (
    <Card className="p-5 space-y-5" data-testid="feedback-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/manage/$slug/$n"
            params={params}
            search
            aria-label="Back to the inbox"
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <AccountAvatar accountId={feedback.authorAccountId} className="h-9 w-9" />
          <div className="min-w-0">
            <Link
              to="/$accountId"
              params={{ accountId: feedback.authorAccountId }}
              className="block truncate font-mono text-sm text-foreground hover:underline"
            >
              {feedback.authorAccountId}
            </Link>
            <p className="text-xs text-muted-foreground">
              {new Date(feedback.createdAt).toLocaleString()} · {feedback.format}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/manage/$slug/$n"
              params={params}
              search={{ ...inboxSearch, author: feedback.authorAccountId }}
            >
              <Filter className="h-3.5 w-3.5" />
              more from this tester
            </Link>
          </Button>
          <FeedbackStatusBadge status={feedback.status} />
        </div>
      </div>

      <FeedbackContent entry={feedback} />

      <div className="space-y-3 border-t border-border pt-4">
        <FeedbackNoteThread notes={feedback.notes} />
        <FeedbackNoteForm
          key={feedback.id}
          roundId={round.id}
          feedbackId={feedback.id}
          placeholder="Note to the tester (optional)"
          submitLabel="send note"
          extraActions={(note, clear) => (
            <FeedbackStatusActions
              current={feedback.status}
              disabled={statusMutation.isPending}
              onChange={(status) =>
                statusMutation.mutate(
                  { feedbackIds: [feedback.id], status, note: note || undefined },
                  { onSuccess: clear },
                )
              }
            />
          )}
        />
      </div>
    </Card>
  );
}
