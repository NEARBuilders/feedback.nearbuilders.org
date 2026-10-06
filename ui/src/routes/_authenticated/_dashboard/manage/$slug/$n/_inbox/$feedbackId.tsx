import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, Filter, RotateCcw, X } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, Markdown } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
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
  const setStatus = (status: "unresolved" | "resolved" | "dismissed") =>
    statusMutation.mutate({ feedbackIds: [feedback.id], status });

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
        <FeedbackStatusBadge status={feedback.status} />
      </div>

      {feedback.format === "written" ? (
        <Markdown content={feedback.body ?? ""} />
      ) : (
        feedback.url && (
          <a
            href={feedback.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline break-all"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {feedback.url}
          </a>
        )
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {feedback.status !== "resolved" && (
          <Button
            size="sm"
            onClick={() => setStatus("resolved")}
            disabled={statusMutation.isPending}
          >
            <Check className="h-3.5 w-3.5" />
            Resolve
            <kbd className="text-[10px] opacity-60">r</kbd>
          </Button>
        )}
        {feedback.status !== "dismissed" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStatus("dismissed")}
            disabled={statusMutation.isPending}
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
            <kbd className="text-[10px] opacity-60">d</kbd>
          </Button>
        )}
        {feedback.status !== "unresolved" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStatus("unresolved")}
            disabled={statusMutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <Link
            to="/manage/$slug/$n"
            params={params}
            search={{ ...inboxSearch, author: feedback.authorAccountId }}
          >
            <Filter className="h-3.5 w-3.5" />
            More from this tester
          </Link>
        </Button>
      </div>
    </Card>
  );
}
