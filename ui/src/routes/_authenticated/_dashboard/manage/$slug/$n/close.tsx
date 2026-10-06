import { createFileRoute } from "@tanstack/react-router";
import { CloseRoundPanel } from "@/components/close-round-panel";
import { RoundCredits } from "@/components/round-credits";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/close")({
  component: CloseTab,
});

function CloseTab() {
  const round = useRound(Route.useParams());
  return round.status === "open" ? (
    <CloseRoundPanel roundId={round.id} />
  ) : (
    <RoundCredits roundId={round.id} />
  );
}
