import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { participationQueryOptions } from "@/lib/queries/participation";
import { roundCta } from "@/lib/round-cta";
import { acceptsFeedback } from "@/lib/round-deadline";
import { roundHref } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { useNearAccountStatus } from "@/lib/use-near-account";

export function useRoundViewer(round: RoundDetail) {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { accountId, isDetecting } = useNearAccountStatus();
  const session = useQuery(sessionQueryOptions(auth));
  const participation = useQuery({
    ...participationQueryOptions(apiClient, round.id),
    enabled: !!accountId,
  });

  const isAdmin = session.data?.user?.role === "admin";
  const canManage = round.canManage ?? false;
  const joined = participation.data?.joined ?? false;
  const isOwner = !!accountId && accountId === round.ownerAccountId;
  const isOpen = round.status === "open";
  const takesFeedback = acceptsFeedback(round);

  return {
    accountId,
    isAdmin,
    canManage,
    joined,
    participationPending: participation.isLoading,
    canSeeParticipants: canManage || isAdmin || joined,
    canPost: joined && takesFeedback,
    /** Open, but past its deadline: still joinable, no longer taking feedback. */
    pastDeadline: isOpen && !takesFeedback,
    cta: roundCta({
      redirectTo: roundHref(round),
      canJoin: isOpen && !isOwner && !canManage,
      sessionPending: session.isPending || isDetecting,
      signedIn: !!session.data?.user,
      nearAccountId: accountId,
      joined,
    }),
  };
}
