import { createFileRoute } from "@tanstack/react-router";
import { RoundParticipants } from "@/components/round-participants";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/participants")({
  component: ParticipantsTab,
});

function ParticipantsTab() {
  const params = Route.useParams();
  const round = useRound(params);
  return <RoundParticipants roundId={round.id} params={params} surface="console" />;
}
