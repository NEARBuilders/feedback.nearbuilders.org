import { describe, expect, it } from "vitest";
import { computeLandingStats, liveRounds } from "./landing-stats";

const now = Date.parse("2026-11-10T12:00:00Z");

const round = (over: Partial<Parameters<typeof computeLandingStats>[0][number]> = {}) => ({
  status: "open" as const,
  endsAt: null,
  participantCount: 0,
  winners: [] as string[],
  ...over,
});

describe("computeLandingStats", () => {
  it("returns zeros when there are no rounds", () => {
    expect(computeLandingStats([], [], now)).toEqual({
      openRounds: 0,
      testers: 0,
      completedRounds: 0,
      winnersRecognised: 0,
    });
  });

  it("counts live open rounds, all testers, closed rounds and winners", () => {
    const stats = computeLandingStats(
      [
        round({ participantCount: 3 }),
        round({ participantCount: 2, endsAt: "2026-11-09T00:00:00Z" }),
      ],
      [
        round({ status: "closed", participantCount: 5, winners: ["a.near", "b.near"] }),
        round({ status: "closed", participantCount: 1 }),
      ],
      now,
    );
    expect(stats).toEqual({
      openRounds: 1,
      testers: 11,
      completedRounds: 2,
      winnersRecognised: 2,
    });
  });
});

describe("liveRounds", () => {
  it("drops expired rounds and respects the limit", () => {
    const rounds = [
      round({ endsAt: "2026-11-09T00:00:00Z" }),
      round({ participantCount: 1 }),
      round({ participantCount: 2 }),
      round({ participantCount: 3 }),
    ];
    expect(liveRounds(rounds, 2, now).map((r) => r.participantCount)).toEqual([1, 2]);
  });
});
