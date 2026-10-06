import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge, Button, ConfirmDialog } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { FeedbackContent } from "@/components/feedback-content";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { type FeedbackEntry, invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { invalidateParticipationQueries } from "@/lib/queries/participation";

interface FeedbackListProps {
  roundId: string;
  entries: Array<FeedbackEntry & { points?: number }>;
  currentAccountId: string | null;
  canDelete: boolean;
}

export function FeedbackList({ roundId, entries, currentAccountId, canDelete }: FeedbackListProps) {
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
      <ul className="space-y-3" data-testid="feedback-list">
        {entries.map((entry) => {
          const isOwn = entry.authorAccountId === currentAccountId;
          return (
            <li key={entry.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <AccountAvatar accountId={entry.authorAccountId} />
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {entry.authorAccountId}
                    {isOwn && " (you)"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                  <FeedbackStatusBadge status={entry.status} />
                  {entry.points !== undefined && (
                    <Badge variant="outline">
                      <Trophy />
                      {entry.points} pts
                    </Badge>
                  )}
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
