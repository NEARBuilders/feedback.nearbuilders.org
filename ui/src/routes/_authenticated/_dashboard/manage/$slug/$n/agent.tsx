import { createFileRoute } from "@tanstack/react-router";
import { AgentReviewPanel } from "@/components/agent-review-panel";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/agent")({
  component: AgentTab,
});

function AgentTab() {
  const round = useRound(Route.useParams());
  return <AgentReviewPanel round={round} />;
}
