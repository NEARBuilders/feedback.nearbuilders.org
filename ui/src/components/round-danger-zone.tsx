import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@/components";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionHeader } from "@/components/layout/section-header";
import { invalidateProjectQueries } from "@/lib/queries/projects";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import type { RoundDetail } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";

/**
 * Moderation actions for a round in the manage console. Admins can hide any
 * round (reversible, keeps feedback and credits) and restore hidden ones;
 * deletion stays available to managers but only for rounds without feedback,
 * so tester attribution is never destroyed.
 */
export function RoundDangerZone({ round }: { round: RoundDetail }) {
  const viewer = useRoundViewer(round);
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () => {
    void invalidateRoundQueries(queryClient);
    void invalidateProjectQueries(queryClient);
  };

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteRound({ id: round.id }),
    onSuccess: () => {
      refresh();
      toast.success("Round deleted");
      void navigate({ to: "/manage" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hideMutation = useMutation({
    mutationFn: () => apiClient.rejectRound({ id: round.id, reason: reason.trim() }),
    onSuccess: () => {
      refresh();
      setHiding(false);
      setReason("");
      toast.success("Round hidden from the public");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: () => apiClient.restoreRound({ id: round.id }),
    onSuccess: () => {
      refresh();
      toast.success("Round restored");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hidden = round.status === "rejected";
  const hideable = round.status === "open" || round.status === "closed";
  const hasFeedback = (round.feedbackCount ?? 0) > 0;

  return (
    <Card className="space-y-4 border-destructive/40 p-5" data-testid="round-danger-zone">
      <SectionHeader title="Danger zone" />

      {hidden && (
        <div className="space-y-2 text-sm" data-testid="round-hidden-note">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <EyeOff className="h-4 w-4" />
            This round is hidden
          </p>
          {round.rejectionReason && (
            <p className="text-xs text-muted-foreground">Reason: {round.rejectionReason}</p>
          )}
          {viewer.isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending}
              data-testid="round-restore"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {restoreMutation.isPending ? "restoring..." : "restore round"}
            </Button>
          )}
        </div>
      )}

      {!hidden && hideable && viewer.isAdmin && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHiding(true)}
            disabled={hideMutation.isPending}
            data-testid="round-hide"
          >
            <EyeOff className="h-3.5 w-3.5" />
            hide round
          </Button>
          <p className="text-xs text-muted-foreground">
            Removes the round from the public listing and blocks new testers, without touching
            feedback or credits. Reversible.
          </p>
        </div>
      )}

      {!hidden && (
        <div className="space-y-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleteMutation.isPending || hasFeedback}
            data-testid="round-delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleteMutation.isPending ? "deleting..." : "delete round"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {hasFeedback
              ? "This round has feedback, so it can't be deleted — an admin can hide it instead."
              : "Permanently removes the round, its participants and its banner. Only possible while it has no feedback."}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this round?"
        description="This permanently removes the round, its participants and its banner. This cannot be undone."
        confirmLabel="Delete round"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />

      <Dialog
        open={hiding}
        onOpenChange={(open) => {
          setHiding(open);
          if (!open) setReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide this round?</DialogTitle>
            <DialogDescription>
              The round leaves the public listing and stops accepting testers. Its feedback and
              credits are kept, and you can restore it any time.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason, shared with the round owner"
            aria-label="Hide reason"
          />
          <DialogFooter className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setHiding(false)}>
              cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => hideMutation.mutate()}
              disabled={hideMutation.isPending || !reason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hideMutation.isPending ? "hiding..." : "hide round"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
