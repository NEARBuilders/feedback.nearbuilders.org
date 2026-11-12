import { isRoundExpired } from "@/lib/round-expiry";

interface StatsRound {
  status: "pending" | "open" | "closed" | "rejected";
  endsAt: string | null;
  participantCount: number;
  winners: string[];
}

export interface LandingStats {
  openRounds: number;
  testers: number;
  completedRounds: number;
  winnersRecognised: number;
}

export function computeLandingStats(
  open: StatsRound[],
  closed: StatsRound[],
  now: number = Date.now(),
): LandingStats {
  const live = open.filter((round) => !isRoundExpired(round, now));
  const all = [...open, ...closed];
  return {
    openRounds: live.length,
    testers: all.reduce((sum, round) => sum + round.participantCount, 0),
    completedRounds: closed.length,
    winnersRecognised: closed.reduce((sum, round) => sum + round.winners.length, 0),
  };
}

export function liveRounds<T extends StatsRound>(
  open: T[],
  limit: number,
  now: number = Date.now(),
) {
  return open.filter((round) => !isRoundExpired(round, now)).slice(0, limit);
}
