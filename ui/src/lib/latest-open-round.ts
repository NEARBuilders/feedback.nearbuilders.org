import { isRoundAcceptingFeedback } from "@/lib/round-expiry";

type ExpiringRound = Parameters<typeof isRoundAcceptingFeedback>[0];

/** The highest-numbered round that is still taking feedback, or null when there is none. */
export function latestOpenRound<T extends ExpiringRound & { projectRoundNumber: number }>(
  rounds: readonly T[],
  now = Date.now(),
): T | null {
  let best: T | null = null;
  for (const round of rounds) {
    if (!isRoundAcceptingFeedback(round, now)) continue;
    if (!best || round.projectRoundNumber > best.projectRoundNumber) best = round;
  }
  return best;
}
