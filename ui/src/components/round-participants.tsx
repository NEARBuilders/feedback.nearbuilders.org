import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useApiClient } from "@/app";
import { Skeleton } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { roundParticipantsQueryOptions } from "@/lib/queries/rounds";
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
  "grid grid-cols-1 items-start gap-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4";

export function RoundParticipants({
  roundId,
  params,
  surface = "public",
}: {
  roundId: string;
  params?: RoundParams;
  surface?: ParticipantPostsSurface;
}) {
  const apiClient = useApiClient();
  const participantsQuery = useQuery(roundParticipantsQueryOptions(apiClient, roundId));
  const participants = participantsQuery.data ?? [];
  const dest = params ? { surface, params } : undefined;

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
                    postLink ? "font-medium text-foreground underline" : "text-muted-foreground",
                  )}
                >
                  {postsLabel(participant.feedbackCount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(participant.joinedAt).toLocaleDateString()}
                </span>
              </>
            );

            return (
              <li key={participant.accountId}>
                {postLink ? (
                  <Link
                    {...postLink}
                    className={cn(rowClassName, "hover:bg-accent")}
                    data-testid="participant-posts-link"
                  >
                    <span className="font-mono text-sm text-foreground break-all">
                      {participant.accountId}
                    </span>
                    {meta}
                  </Link>
                ) : (
                  <div className={rowClassName}>
                    <span className="font-mono text-sm text-foreground break-all">
                      {participant.accountId}
                    </span>
                    {meta}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
