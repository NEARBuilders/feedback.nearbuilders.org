import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components";
import { CloseRoundPanel } from "@/components/close-round-panel";
import { RoundCredits } from "@/components/round-credits";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/close")({
  component: CloseTab,
});

function CloseTab() {
  const round = useRound(Route.useParams());
  if (round.status === "open") return <CloseRoundPanel roundId={round.id} />;
  return (
    <div className="space-y-6">
      <EmptyState
        icon={Lock}
        title={round.status === "closed" ? "This round is closed." : "This round isn't open yet."}
        className="min-h-[20vh]"
      />
      <RoundCredits roundId={round.id} />
    </div>
  );
}
