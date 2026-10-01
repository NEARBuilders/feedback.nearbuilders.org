import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge, Button, Card, Field, FieldLabel, Input, SectionHeader } from "@/components";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_admin/_dashboard/admin/rounds")({
  head: () => ({
    meta: [{ title: "Round approvals | Admin" }],
  }),
  component: RoundApprovalsPage,
});

function RoundApprovalsPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: ["rounds", "pending"],
    queryFn: () => apiClient.listPendingRounds(),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["rounds", "pending"] });
  };

  const rounds = pendingQuery.data ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader title="Round approvals" />
      {pendingQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rounds are waiting for review.</p>
      ) : (
        <ul className="space-y-3">
          {rounds.map((round) => (
            <PendingRoundCard key={round.id} round={round} onDecided={invalidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingRoundCard({
  round,
  onDecided,
}: {
  round: {
    id: string;
    title: string;
    description: string;
    projectSlug: string;
    ownerAccountId: string;
    repoUrl: string | null;
    formats: string[];
    createdAt: string;
  };
  onDecided: () => void;
}) {
  const apiClient = useApiClient();
  const [reason, setReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: () => apiClient.approveRound({ id: round.id }),
    onSuccess: () => {
      toast.success(`Approved "${round.title}"`);
      onDecided();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiClient.rejectRound({ id: round.id, reason: reason.trim() || undefined }),
    onSuccess: () => {
      toast.success(`Rejected "${round.title}"`);
      onDecided();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <Link
            to="/feed/$roundId"
            params={{ roundId: round.id }}
            className="text-sm font-semibold text-foreground underline"
          >
            {round.title}
          </Link>
          <p className="text-xs font-mono text-muted-foreground">
            {round.projectSlug} · {round.ownerAccountId}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {round.formats.map((format) => (
            <Badge key={format} variant="outline" className="text-[10px]">
              {format}
            </Badge>
          ))}
        </div>
      </div>

      <p className="text-sm text-foreground whitespace-pre-wrap">{round.description}</p>

      {round.repoUrl && <p className="text-xs text-muted-foreground break-all">{round.repoUrl}</p>}

      <Field>
        <FieldLabel htmlFor={`reject-reason-${round.id}`}>rejection reason (optional)</FieldLabel>
        <Input
          id={`reject-reason-${round.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why isn't this ready?"
          disabled={pending}
        />
      </Field>

      <div className="flex gap-2">
        <Button onClick={() => approveMutation.mutate()} disabled={pending}>
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button variant="outline" onClick={() => rejectMutation.mutate()} disabled={pending}>
          {rejectMutation.isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </Card>
  );
}
