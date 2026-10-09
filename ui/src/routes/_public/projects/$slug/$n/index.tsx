import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ExternalLink, Lock, Timer, Users } from "lucide-react";
import { useApiClient } from "@/app";
import { Badge, Card, LegionMark, RoundCountdown } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { EndorsementCount } from "@/components/endorsement-count";
import { RoundCredits } from "@/components/round-credits";
import { RoundJoinCta } from "@/components/round-join-cta";
import { RoundParticipants } from "@/components/round-participants";
import { RoundReadme } from "@/components/round-readme";
import { RoundRepoLinks } from "@/components/round-repo-links";
import { type LegionAccessResult, useLegionAccess } from "@/hooks/use-legion-access";
import { roundEndorsementsQueryOptions, roundParticipantsQueryOptions } from "@/lib/queries/rounds";
import { FORMAT_LABELS } from "@/lib/round-fields";
import { type RoundDetail, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";

export const Route = createFileRoute("/_public/projects/$slug/$n/")({
  component: RoundOverviewPage,
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function RoundOverviewPage() {
  const round = useRound(Route.useParams());
  const apiClient = useApiClient();
  const viewer = useRoundViewer(round);

  const { data: endorsements } = useQuery(roundEndorsementsQueryOptions(apiClient, [round.id]));
  const endorsement = endorsements?.[round.id];

  return (
    <div
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]"
      data-testid="round-overview"
    >
      <div className="min-w-0">
        <RoundReadme roundId={round.id} readme={round.readme} canEdit={false} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <JoinCard round={round} viewer={viewer} />
        <DetailsCard round={round} endorsement={endorsement} />
        {round.status === "closed" && <RoundCredits roundId={round.id} />}
        {viewer.canSeeParticipants && <RoundParticipants roundId={round.id} />}
      </aside>
    </div>
  );
}

function JoinCard({
  round,
  viewer,
}: {
  round: RoundDetail;
  viewer: ReturnType<typeof useRoundViewer>;
}) {
  const apiClient = useApiClient();
  const participantsQuery = useQuery({
    ...roundParticipantsQueryOptions(apiClient, round.id),
    enabled: viewer.canSeeParticipants,
  });
  const faces = (participantsQuery.data ?? []).slice(0, 3);
  const needsLegionCheck = round.legionOnly && viewer.cta.kind === "join";
  const { legionAccess } = useLegionAccess(needsLegionCheck);
  const legionBlocked = needsLegionCheck && legionAccess?.hasAccess !== true;

  return (
    <Card className="space-y-4 p-5" data-testid="round-join-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {faces.length > 0 ? (
          <span className="flex -space-x-2">
            {faces.map((participant) => (
              <AccountAvatar key={participant.accountId} accountId={participant.accountId} />
            ))}
          </span>
        ) : (
          <Users className="h-4 w-4" />
        )}
        <span>
          {round.participantCount} {round.participantCount === 1 ? "tester" : "testers"} joined
        </span>
      </div>

      {viewer.cta.kind !== "none" && (
        <RoundJoinCta
          round={round}
          cta={viewer.cta}
          legionBlocked={legionBlocked}
          canPost={viewer.canPost}
        />
      )}

      {needsLegionCheck && legionAccess && <LegionEligibility legionAccess={legionAccess} />}
      {viewer.isExpired && (
        <p className="text-sm text-muted-foreground" data-testid="round-expired-notice">
          This round has expired, so joining and posting are closed.
        </p>
      )}
    </Card>
  );
}

function DetailsCard({
  round,
  endorsement,
}: {
  round: RoundDetail;
  endorsement?: { totalCount: number };
}) {
  return (
    <Card className="space-y-4 p-5" data-testid="round-details">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        details
      </span>

      {endorsement && <EndorsementCount count={endorsement.totalCount} />}

      <div className="flex flex-wrap items-center gap-1.5">
        {round.formats.map((format) => (
          <Badge key={format} variant="outline">
            {FORMAT_LABELS[format] ?? format}
          </Badge>
        ))}
        <RoundRepoLinks round={round} />
        {round.isPrivate && (
          <Badge variant="secondary" className="gap-1 text-xs" data-testid="private-badge">
            <Lock className="h-3 w-3" />
            Private feedback
          </Badge>
        )}
        {round.legionOnly && (
          <Badge variant="secondary" className="gap-1 text-xs" data-testid="legion-badge">
            <LegionMark />
            Legion members only
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          started {formatDate(round.createdAt)}
        </span>
        {round.endsAt && round.status === "open" && (
          <span className="flex items-center gap-1.5" data-testid="round-ends-at">
            <Timer className="h-3.5 w-3.5" />
            <RoundCountdown endsAt={round.endsAt} />
          </span>
        )}
        {round.closedAt && <span>closed {formatDate(round.closedAt)}</span>}
      </div>
    </Card>
  );
}

function LegionEligibility({ legionAccess }: { legionAccess: LegionAccessResult }) {
  if (legionAccess.hasAccess) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="legion-eligible">
        You hold a Legion SBT, so you can join this round.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground" data-testid="legion-ineligible">
      You need a Legion SBT to join.{" "}
      {legionAccess.linkedNearAccount
        ? `${legionAccess.linkedNearAccount} doesn't hold one yet.`
        : "Link a NEAR account that holds one."}{" "}
      <a
        href={legionAccess.mintUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-foreground underline"
      >
        Get a Legion SBT
        <ExternalLink className="h-3 w-3" />
      </a>
    </p>
  );
}
