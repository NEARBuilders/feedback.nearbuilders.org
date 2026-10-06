import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, ConfirmDialog } from "@/components";
import { FeedbackContent } from "@/components/feedback-content";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { type FeedbackEntry, invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { invalidateParticipationQueries } from "@/lib/queries/participation";

interface FeedbackListProps<T extends FeedbackEntry & { points?: number }> {
  roundId: string;
  entries: T[];
  currentAccountId: string | null;
  canDelete: boolean;
  renderFooter?: (entry: T) => ReactNode;
}

export function FeedbackList<T extends FeedbackEntry & { points?: number }>({
  roundId,
  entries,
  currentAccountId,
  canDelete,
  renderFooter,
}: FeedbackListProps<T>) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (feedbackId: string) => apiClient.deleteFeedback({ id: roundId, feedbackId }),
    onSuccess: () => {
      void invalidateFeedbackQueries(queryClient, roundId);
      void invalidateParticipationQueries(queryClient);
      setDeleteId(null);
      toast.success("Feedback deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <ul
        className="divide-y divide-border rounded-lg border border-border bg-card"
        data-testid="feedback-list"
      >
        {entries.map((entry) => {
          const isOwn = entry.authorAccountId === currentAccountId;
          return (
            <li key={entry.id} className="space-y-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  <span className="font-mono">{entry.authorAccountId}</span>
                  {isOwn && " (you)"} · {new Date(entry.createdAt).toLocaleDateString()}
                  {entry.points !== undefined && ` · ${entry.points} pts`}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <FeedbackStatusBadge status={entry.status} />
                  {isOwn && canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete feedback"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </span>
              </div>
              <FeedbackContent entry={entry} />
              {renderFooter?.(entry)}
            </li>
          );
        })}
      </ul>

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
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
      />
    </>
  );
}
