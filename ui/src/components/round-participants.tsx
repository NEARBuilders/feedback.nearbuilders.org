import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Skeleton } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { invalidateRoundQueries, roundParticipantsQueryOptions } from "@/lib/queries/rounds";
import {
  type ParticipantPostsSurface,
  participantPostLink,
  type RoundParams,
} from "@/lib/round-links";
import { cn } from "@/lib/utils";

function postsLabel(count: number) {
  return `${count} ${count === 1 ? "post" : "posts"}`;
}

const rowClassName =
  "grid min-w-0 grid-cols-1 items-start gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4";

export function RoundParticipants({
  roundId,
  params,
  surface = "public",
  viewerAccountId,
  canReadAll,
  winners = [],
  canMarkWinners,
}: {
  roundId: string;
  params?: RoundParams;
  surface?: ParticipantPostsSurface;
  viewerAccountId?: string | null;
  canReadAll?: boolean;
  /** Account ids the owner marked as winners, in the order they were marked. */
  winners?: readonly string[];
  /** Shows the mark-as-winner toggle on each row; only round managers get it. */
  canMarkWinners?: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const winnerMutation = useMutation({
    mutationFn: (next: string[]) => apiClient.updateRoundSettings({ id: roundId, winners: next }),
    onSuccess: () => void invalidateRoundQueries(queryClient),
    onError: (err: Error) => toast.error(err.message),
  });
  const toggleWinner = (accountId: string) =>
    winnerMutation.mutate(
      winners.includes(accountId)
        ? winners.filter((id) => id !== accountId)
        : [...winners, accountId],
    );
  const participantsQuery = useQuery(roundParticipantsQueryOptions(apiClient, roundId));
  const participants = participantsQuery.data ?? [];
  const dest = params ? { surface, params, viewerAccountId, canReadAll } : undefined;

  return (
    <div className="space-y-3" data-testid="round-participants">
      <SectionHeader
        title="Participants"
        action={
          participants.length > 0 ? (
            <span className="text-sm text-muted-foreground">{participants.length}</span>
          ) : undefined
        }
      />
      {participantsQuery.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : participantsQuery.isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load participants.</p>
      ) : participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has joined this round yet.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {participants.map((participant) => {
            const postLink = participantPostLink(
              participant.accountId,
              participant.feedbackCount,
              dest,
            );
            const meta = (
              <>
                <span
                  className={cn(
                    "text-xs",
                    postLink ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {postsLabel(participant.feedbackCount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(participant.joinedAt).toLocaleDateString()}
                </span>
              </>
            );

            const isWinner = winners.includes(participant.accountId);
            const winnerMark = isWinner ? (
              <Trophy className="mr-1.5 inline h-3.5 w-3.5 text-amber-500" aria-label="Winner" />
            ) : null;

            return (
              <li key={participant.accountId} className="flex items-center">
                <div className="min-w-0 flex-1">
                  {postLink ? (
                    <Link
                      {...postLink}
                      className={cn(rowClassName, "hover:bg-accent")}
                      data-testid="participant-posts-link"
                    >
                      <span className="min-w-0 font-mono text-sm text-foreground break-words">
                        {winnerMark}
                        {participant.accountId}
                      </span>
                      {meta}
                    </Link>
                  ) : (
                    <div className={rowClassName}>
                      <span className="min-w-0 font-mono text-sm text-foreground break-words">
                        {winnerMark}
                        {participant.accountId}
                      </span>
                      {meta}
                    </div>
                  )}
                </div>
                {canMarkWinners && (
                  <Button
                    variant={isWinner ? "secondary" : "ghost"}
                    size="sm"
                    className="mr-3 shrink-0"
                    disabled={winnerMutation.isPending}
                    aria-pressed={isWinner}
                    data-testid="participant-winner-toggle"
                    onClick={() => toggleWinner(participant.accountId)}
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    {isWinner ? "Winner" : "Mark winner"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
