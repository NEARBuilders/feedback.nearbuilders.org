import { useMutation, useQueryClient, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, ConfirmDialog } from "@/components";
import { FeedbackComposer } from "@/components/feedback-composer";
import { FeedbackList } from "@/components/feedback-list";
import { SectionHeader } from "@/components/layout/section-header";
import { invalidateFeedbackQueries, roundFeedbackQueryOptions } from "@/lib/queries/feedback";
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
  const round = useRound(Route.useParams());
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const viewer = useRoundViewer(round);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const feedbackQuery = useSuspenseInfiniteQuery(roundFeedbackQueryOptions(apiClient, round.id));
  const entries = feedbackQuery.data.pages.flatMap((page) => page.items);

  const deleteMutation = useMutation({
    mutationFn: (feedbackId: string) => apiClient.deleteFeedback({ id: round.id, feedbackId }),
    onSuccess: () => {
      void invalidateFeedbackQueries(queryClient, round.id);
      toast.success("Feedback deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const issues = round.formats.includes("issues") ? issuesUrl(round.repoUrl) : null;

  return (
    <div id="feedback" className="space-y-4">
      <SectionHeader title="Feedback" />

      {issues && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            For bugs, file an issue on the project's GitHub so it's tracked where fixes land.{" "}
            <a
              href={issues}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline"
            >
              File an issue
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </Card>
      )}

      {viewer.canPost && <FeedbackComposer roundId={round.id} formats={round.formats} />}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <FeedbackList
          entries={entries}
          currentAccountId={viewer.accountId}
          onDelete={round.status === "open" ? setDeleteId : undefined}
        />
      )}

      {feedbackQuery.hasNextPage && (
        <Button
          variant="outline"
          onClick={() => void feedbackQuery.fetchNextPage()}
          disabled={feedbackQuery.isFetchingNextPage}
        >
          {feedbackQuery.isFetchingNextPage ? "Loading..." : "Load more"}
        </Button>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete this feedback?"
        description="Your feedback will be removed from the round. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
