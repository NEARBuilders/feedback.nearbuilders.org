import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "@/app";
import { Skeleton } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { SectionHeader } from "@/components/layout/section-header";
import { roundParticipantsQueryOptions } from "@/lib/queries/rounds";

export function RoundParticipants({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const participantsQuery = useQuery(roundParticipantsQueryOptions(apiClient, roundId));
  const participants = participantsQuery.data ?? [];

  return (
    <div className="space-y-3">
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
        <ul className="divide-y divide-border rounded-lg border border-border">
          {participants.map((participant) => (
            <li
              key={participant.accountId}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <AccountAvatar accountId={participant.accountId} />
                <span className="font-mono text-sm text-foreground break-all">
                  {participant.accountId}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                Joined {new Date(participant.joinedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
