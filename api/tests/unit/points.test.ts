import { describe, expect, it } from "vitest";
import {
  POINTS_PER_ACCEPTED_FEEDBACK,
  periodStart,
  pointsForAccepted,
  rankStandings,
} from "@/services/points";

describe("pointsForAccepted", () => {
  it("awards a fixed number of points per accepted feedback item", () => {
    expect(POINTS_PER_ACCEPTED_FEEDBACK).toBe(10);
    expect(pointsForAccepted(0)).toBe(0);
    expect(pointsForAccepted(1)).toBe(10);
    expect(pointsForAccepted(7)).toBe(70);
  });

  it("never goes negative", () => {
    expect(pointsForAccepted(-3)).toBe(0);
  });
});

describe("periodStart", () => {
  const now = new Date("2026-10-06T12:00:00.000Z");

  it("uses rolling 7 and 30 day windows and no lower bound for all-time", () => {
    expect(periodStart("weekly", now)?.toISOString()).toBe("2026-09-29T12:00:00.000Z");
    expect(periodStart("monthly", now)?.toISOString()).toBe("2026-09-06T12:00:00.000Z");
    expect(periodStart("all-time", now)).toBeNull();
  });
});

describe("rankStandings", () => {
  it("orders by accepted count, then account id, and gives ties the same rank", () => {
    const standings = rankStandings([
      { accountId: "carol.near", acceptedCount: 2 },
      { accountId: "alice.near", acceptedCount: 5 },
      { accountId: "bob.near", acceptedCount: 2 },
      { accountId: "dave.near", acceptedCount: 1 },
    ]);
    expect(standings).toEqual([
      { rank: 1, accountId: "alice.near", points: 50, acceptedCount: 5 },
      { rank: 2, accountId: "bob.near", points: 20, acceptedCount: 2 },
      { rank: 2, accountId: "carol.near", points: 20, acceptedCount: 2 },
      { rank: 4, accountId: "dave.near", points: 10, acceptedCount: 1 },
    ]);
  });

  it("leaves out people with nothing accepted and handles an empty list", () => {
    expect(rankStandings([{ accountId: "zed.near", acceptedCount: 0 }])).toEqual([]);
    expect(rankStandings([])).toEqual([]);
  });
});
