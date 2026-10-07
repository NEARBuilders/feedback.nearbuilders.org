import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, PenLine, Users } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge, Button } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { EndorsementCount } from "@/components/endorsement-count";
import { RoundCredits } from "@/components/round-credits";
import { RoundParticipants } from "@/components/round-participants";
import { RoundReadme } from "@/components/round-readme";
import { RoundRepoLinks } from "@/components/round-repo-links";
import { roundActivityUrl } from "@/lib/activity-events";
import { invalidateParticipationQueries } from "@/lib/queries/participation";
import {
  invalidateRoundQueries,
  roundEndorsementsQueryOptions,
  roundParticipantsQueryOptions,
} from "@/lib/queries/rounds";
import { FORMAT_LABELS } from "@/lib/round-fields";
import { roundParams } from "@/lib/round-links";
import { type RoundDetail, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";

export const Route = createFileRoute("/_public/projects/$slug/$n/")({
  component: RoundOverviewPage,
});

function RoundOverviewPage() {
  const round = useRound(Route.useParams());
  const apiClient = useApiClient();
  const viewer = useRoundViewer(round);

  const { data: endorsements } = useQuery(roundEndorsementsQueryOptions(apiClient, [round.id]));
  const endorsement = endorsements?.[round.id];

  return (
    <div className="space-y-8">
      <RoundReadme roundId={round.id} readme={round.readme} canEdit={false} />

      {endorsement && (
        <div className="flex flex-wrap items-center gap-3">
          <EndorsementCount count={endorsement.totalCount} />
          <a
            href={roundActivityUrl(round.ownerAccountId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-foreground underline"
          >
            Endorse on activity
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {round.formats.map((format) => (
          <Badge key={format} variant="outline">
            {FORMAT_LABELS[format] ?? format}
          </Badge>
        ))}
        <RoundRepoLinks round={round} />
      </div>

      <TestersRow round={round} viewer={viewer} />

      {round.status === "closed" && <RoundCredits roundId={round.id} />}

      {viewer.canSeeParticipants && <RoundParticipants roundId={round.id} />}
    </div>
  );
}

function TestersRow({
  round,
  viewer,
}: {
  round: RoundDetail;
  viewer: ReturnType<typeof useRoundViewer>;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { cta } = viewer;
  const participantsQuery = useQuery({
    ...roundParticipantsQueryOptions(apiClient, round.id),
    enabled: viewer.canSeeParticipants,
  });
  const faces = (participantsQuery.data ?? []).slice(0, 3);

  const joinMutation = useMutation({
    mutationFn: (next: boolean) =>
      next ? apiClient.joinRound({ id: round.id }) : apiClient.leaveRound({ id: round.id }),
    onSuccess: (_detail, next) => {
      void invalidateRoundQueries(queryClient);
      void invalidateParticipationQueries(queryClient);
      toast.success(next ? "Joined the round" : "Left the round");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {faces.length > 0 ? (
          <span className="flex -space-x-2">
            {faces.map((participant) => (
              <AccountAvatar key={participant.accountId} accountId={participant.accountId} />
            ))}
          </span>
        ) : (
          <Users className="h-4 w-4" />
        )}
        {round.participantCount} {round.participantCount === 1 ? "tester" : "testers"} joined
      </span>

      {(cta.kind === "join" || cta.kind === "leave") && (
        <div className="flex gap-2">
          {viewer.canPost && (
            <Button asChild>
              <Link to="/testing/$slug/$n" params={roundParams(round)}>
                <PenLine className="h-4 w-4" />
                write feedback
              </Link>
            </Button>
          )}
          <Button
            variant={cta.kind === "leave" ? "outline" : "default"}
            onClick={() => joinMutation.mutate(cta.kind === "join")}
            disabled={joinMutation.isPending || viewer.participationPending}
          >
            {cta.kind === "leave" ? "leave round" : "join round"}
          </Button>
        </div>
      )}
      {cta.kind === "signin" && (
        <Link
          to={cta.loginTo.to}
          search={cta.loginTo.search}
          className="text-sm text-foreground underline"
        >
          sign in to join
        </Link>
      )}
      {cta.kind === "link-account" && (
        <Link to="/settings/auth-methods" className="text-sm text-foreground underline">
          link a NEAR account to join
        </Link>
      )}
    </div>
  );
}
