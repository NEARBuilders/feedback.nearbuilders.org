import { createFileRoute } from "@tanstack/react-router";
import { RoundBannerForm } from "@/components/round-banner-form";
import { RoundDangerZone } from "@/components/round-danger-zone";
import { RoundFormatsForm } from "@/components/round-formats-form";
import { RoundReadme } from "@/components/round-readme";
import { RoundSettingsPanel } from "@/components/round-settings-panel";
import { useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n/settings")({
  component: SettingsTab,
});

function SettingsTab() {
  const round = useRound(Route.useParams());
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <RoundReadme roundId={round.id} readme={round.readme} canEdit />
      <div className="space-y-6">
        <RoundBannerForm key={round.bannerUrl ?? ""} round={round} />
        <RoundFormatsForm key={round.formats.join()} round={round} />
        <RoundSettingsPanel
          key={round.endsAt ?? ""}
          roundId={round.id}
          isPrivate={round.isPrivate}
          legionOnly={round.legionOnly}
          endsAt={round.endsAt}
        />
        <RoundDangerZone round={round} />
      </div>
    </div>
  );
}
