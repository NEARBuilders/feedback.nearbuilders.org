import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, EmptyState } from "@/components";
import { ActionCard } from "@/components/action-card";
import { BroadcastPanel } from "@/components/broadcast-panel";
import { roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { type RoundDetail, useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/broadcast")({
  component: BroadcastTab,
});

function BroadcastTab() {
  const round = useRound(Route.useParams());
  if (round.status !== "open") {
    return (
      <EmptyState
        icon={Megaphone}
        title="Broadcasts are for open rounds."
        className="min-h-[30vh]"
      />
    );
  }
  return (
    <div className="space-y-6">
      {round.projectRoundNumber > 1 && <InvitePreviousTesters round={round} />}
      <BroadcastPanel roundId={round.id} participantCount={round.participantCount} />
    </div>
  );
}

function InvitePreviousTesters({ round }: { round: RoundDetail }) {
  const apiClient = useApiClient();
  const previousNumber = round.projectRoundNumber - 1;
  const previous = useQuery(roundBySlugQueryOptions(apiClient, round.projectSlug, previousNumber));

  const inviteMutation = useMutation({
    mutationFn: (fromRoundId: string) => apiClient.inviteTesters({ id: round.id, fromRoundId }),
    onSuccess: ({ recipients }) =>
      toast.success(`Invited ${recipients} ${recipients === 1 ? "tester" : "testers"}`),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!previous.data) return null;
  const fromRoundId = previous.data.id;

  return (
    <ActionCard>
      <p className="text-sm text-muted-foreground">
        Invite the testers from round {previousNumber} who haven't joined this one yet.
      </p>
      <Button
        size="sm"
        onClick={() => inviteMutation.mutate(fromRoundId)}
        disabled={inviteMutation.isPending}
      >
        <Send className="h-3.5 w-3.5" />
        invite previous testers
      </Button>
    </ActionCard>
  );
}
