import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { type RoundCta, roundCta } from "@/lib/round-cta";
import { isRoundAcceptingFeedback } from "@/lib/round-expiry";
import { roundHref } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { useNearAccountStatus } from "@/lib/use-near-account";

/**
 * Resolves the join, leave or sign-in action for any round in a list, so the rounds table and
 * the landing page offer the same one-click join (#301). One joined-rounds query backs every
 * row, instead of a participation check each.
 */
export function useRoundCtas(): {
  ctaFor: (round: RoundDetail) => RoundCta;
  sessionPending: boolean;
} {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { accountId, isDetecting } = useNearAccountStatus();
  const session = useQuery(sessionQueryOptions(auth));
  const joinedRounds = useQuery({
    ...joinedRoundsQueryOptions(apiClient),
    enabled: !!accountId,
  });
  const joinedIds = useMemo(
    () => new Set((joinedRounds.data ?? []).map((joined) => joined.roundId)),
    [joinedRounds.data],
  );
  const sessionPending = session.isPending || isDetecting;
  const signedIn = !!session.data?.user;

  const ctaFor = useCallback(
    (round: RoundDetail) =>
      roundCta({
        redirectTo: roundHref(round),
        canJoin: isRoundAcceptingFeedback(round) && accountId !== round.ownerAccountId,
        sessionPending,
        signedIn,
        nearAccountId: accountId,
        joined: joinedIds.has(round.id),
      }),
    [accountId, sessionPending, signedIn, joinedIds],
  );

  return { ctaFor, sessionPending };
}
