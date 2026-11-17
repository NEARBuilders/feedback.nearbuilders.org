import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { feedbackText } from "@/lib/feedback-export";
import { describeSuggestion, snippet } from "@/lib/feedback-suggestions";
import { invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { type FeedbackSuggestion, suggestionsQueryOptions } from "@/lib/queries/suggestions";

interface PanelEntry {
  id: string;
  format: "written" | "recorded";
  body: string | null;
  url: string | null;
}

interface FeedbackSuggestionsPanelProps {
  roundId: string;
  /** The feedback already loaded in the inbox, used to show what each suggestion is about. */
  entries: PanelEntry[];
}

/**
 * Suggestions an agent left through an organization key (#296). Org keys can't change
 * anything, so a member accepts each one here, which runs the normal resolve, dismiss or
 * star, or rejects it.
 */
export function FeedbackSuggestionsPanel({ roundId, entries }: FeedbackSuggestionsPanelProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const suggestions = useQuery(suggestionsQueryOptions(apiClient, roundId));

  const decide = useMutation({
    mutationFn: async ({ items, accept }: { items: FeedbackSuggestion[]; accept: boolean }) => {
      if (accept) {
        for (const item of items) {
          if (item.status) {
            await apiClient.setFeedbackStatus({
              id: roundId,
              feedbackIds: [item.feedbackId],
              status: item.status,
            });
          }
          if (item.star) {
            await apiClient.setFeedbackStarred({
              id: roundId,
              feedbackIds: [item.feedbackId],
              starred: true,
            });
          }
        }
      }
      await apiClient.clearFeedbackSuggestions({
        id: roundId,
        feedbackIds: items.map((item) => item.feedbackId),
      });
      return { count: items.length, accept };
    },
    onSuccess: ({ count, accept }) => {
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.success(
        `${accept ? "Applied" : "Rejected"} ${count} suggestion${count === 1 ? "" : "s"}`,
      );
    },
    onError: (err: Error) => {
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.error(err.message);
    },
  });

  const items = suggestions.data ?? [];
  if (items.length === 0) return null;

  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return (
    <Card className="space-y-3 p-4" data-testid="feedback-suggestions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Suggested by your agent ({items.length})
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ items, accept: false })}
          >
            reject all
          </Button>
          <Button
            size="sm"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ items, accept: true })}
          >
            accept all
          </Button>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const entry = byId.get(item.feedbackId);
          return (
            <li key={item.feedbackId} className="flex flex-wrap items-start gap-3 py-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{describeSuggestion(item)}</span>
                  {entry ? `: ${snippet(feedbackText(entry))}` : ""}
                </p>
                {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
              </div>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Reject suggestion"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ items: [item], accept: false })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  aria-label="Accept suggestion"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ items: [item], accept: true })}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
