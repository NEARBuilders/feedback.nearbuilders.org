import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { participationQueryOptions } from "@/lib/queries/participation";
import { roundCta } from "@/lib/round-cta";
import { roundHref } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { useNearAccountStatus } from "@/lib/use-near-account";

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

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
  const now = useNow(isOpen && !!round.endsAt);
  const isExpired = isOpen && !!round.endsAt && new Date(round.endsAt).getTime() <= now;

  return {
    accountId,
    isAdmin,
    canManage,
    joined,
    participationPending: participation.isLoading,
    canSeeParticipants: canManage || isAdmin || joined,
    isExpired,
    canPost: joined && isOpen && !isExpired,
    cta: roundCta({
      redirectTo: roundHref(round),
      canJoin: isOpen && !isExpired && !isOwner && !canManage,
      sessionPending: session.isPending || isDetecting,
      signedIn: !!session.data?.user,
      nearAccountId: accountId,
      joined,
    }),
  };
}
