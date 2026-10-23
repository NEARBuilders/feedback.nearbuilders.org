import type { RoundStatus } from "@/lib/queries/rounds";

interface ExpiringRound {
  status: RoundStatus;
  endsAt?: string | null;
}

/**
 * A round stays `open` until a manager closes it, so one past its `endsAt` is still open on the
 * server but rejects every write. Use this instead of `status === "open"` to decide whether a
 * round still takes joins or feedback.
 */
export function isRoundExpired(round: ExpiringRound, now = Date.now()): boolean {
  return round.status === "open" && !!round.endsAt && new Date(round.endsAt).getTime() <= now;
}

export function isRoundAcceptingFeedback(round: ExpiringRound, now = Date.now()): boolean {
  return round.status === "open" && !isRoundExpired(round, now);
}
