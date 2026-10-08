import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, ConfirmDialog, Input, MarkdownEditor } from "@/components";
import { FeedbackContent } from "@/components/feedback-content";
import { StarBadge } from "@/components/feedback-star-badge";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { type FeedbackEntry, invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { invalidateParticipationQueries } from "@/lib/queries/participation";

const FEEDBACK_BODY_MAX = 5000;

interface FeedbackListProps<T extends FeedbackEntry> {
  roundId: string;
  entries: T[];
  currentAccountId: string | null;
  canDelete: boolean;
  renderFooter?: (entry: T) => ReactNode;
}

export function FeedbackList<T extends FeedbackEntry>({
  roundId,
  entries,
  currentAccountId,
  canDelete,
  renderFooter,
}: FeedbackListProps<T>) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingUploads, setPendingUploads] = useState(0);

  const editMutation = useMutation({
    mutationFn: (entry: FeedbackEntry) =>
      apiClient.editFeedback({
        id: roundId,
        feedbackId: entry.id,
        ...(entry.format === "written" ? { body: draft } : { url: draft }),
      }),
    onSuccess: () => {
      void invalidateFeedbackQueries(queryClient, roundId);
      setEditId(null);
      toast.success("Feedback updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (entry: FeedbackEntry) => {
    setDraft((entry.format === "written" ? entry.body : entry.url) ?? "");
    setEditId(entry.id);
  };

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
            <li
              key={entry.id}
              id={`feedback-${entry.id}`}
              className="scroll-mt-20 space-y-2 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  <span className="font-mono">{entry.authorAccountId}</span>
                  {isOwn && " (you)"} · {new Date(entry.createdAt).toLocaleDateString()}
                  {entry.updatedAt && (
                    <span title={new Date(entry.updatedAt).toLocaleString()}> · edited</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {entry.starredAt && <StarBadge data-testid="star-badge" />}
                  <FeedbackStatusBadge status={entry.status} />
                  {isOwn && canDelete && editId !== entry.id && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit feedback"
                      onClick={() => startEdit(entry)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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
              {editId === entry.id ? (
                <div className="space-y-2">
                  {entry.format === "written" ? (
                    <MarkdownEditor
                      aria-label="Edit feedback"
                      value={draft}
                      onChange={setDraft}
                      maxLength={FEEDBACK_BODY_MAX}
                      onPendingUploadsChange={setPendingUploads}
                    />
                  ) : (
                    <Input
                      aria-label="Edit session link"
                      type="url"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={editMutation.isPending}
                      onClick={() => setEditId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!draft.trim() || pendingUploads > 0 || editMutation.isPending}
                      onClick={() => editMutation.mutate(entry)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <FeedbackContent entry={entry} />
              )}
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
