import { createFileRoute } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components";
import { BroadcastPanel } from "@/components/broadcast-panel";
import { useRound } from "@/lib/round-route";

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
  return <BroadcastPanel roundId={round.id} participantCount={round.participantCount} />;
}
