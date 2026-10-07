import { createFileRoute } from "@tanstack/react-router";
import { RoundFormatsForm } from "@/components/round-formats-form";
import { RoundReadme } from "@/components/round-readme";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/settings")({
  component: SettingsTab,
});

function SettingsTab() {
  const round = useRound(Route.useParams());
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <RoundReadme roundId={round.id} readme={round.readme} canEdit />
      <RoundFormatsForm key={round.formats.join()} round={round} />
    </div>
  );
}
