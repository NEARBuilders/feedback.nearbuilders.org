import { describe, expect, it } from "vitest";
import {
  BONUS_POINTS_PER_STARRED_FEEDBACK,
  bonusPointsForStarred,
  POINTS_PER_ACCEPTED_FEEDBACK,
  periodStart,
  pointsForAccepted,
  rankStandings,
  totalPoints,
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
      {
        rank: 1,
        accountId: "alice.near",
        points: 50,
        acceptedCount: 5,
        starredCount: 0,
        bonusPoints: 0,
      },
      {
        rank: 2,
        accountId: "bob.near",
        points: 20,
        acceptedCount: 2,
        starredCount: 0,
        bonusPoints: 0,
      },
      {
        rank: 2,
        accountId: "carol.near",
        points: 20,
        acceptedCount: 2,
        starredCount: 0,
        bonusPoints: 0,
      },
      {
        rank: 4,
        accountId: "dave.near",
        points: 10,
        acceptedCount: 1,
        starredCount: 0,
        bonusPoints: 0,
      },
    ]);
  });

  it("leaves out people with nothing accepted and handles an empty list", () => {
    expect(rankStandings([{ accountId: "zed.near", acceptedCount: 0 }])).toEqual([]);
    expect(rankStandings([])).toEqual([]);
  });
});

describe("starred bonus (#104)", () => {
  it("adds a fixed bonus per starred accepted item on top of the accepted points", () => {
    expect(BONUS_POINTS_PER_STARRED_FEEDBACK).toBe(5);
    expect(bonusPointsForStarred(2, 3)).toBe(10);
    expect(totalPoints(3, 2)).toBe(40);
    expect(totalPoints(3, 0)).toBe(30);
  });

  it("never pays a bonus for stars beyond the accepted count, or below zero", () => {
    expect(bonusPointsForStarred(5, 2)).toBe(10);
    expect(bonusPointsForStarred(3, 0)).toBe(0);
    expect(bonusPointsForStarred(-1, 4)).toBe(0);
    expect(totalPoints(0, 9)).toBe(0);
  });

  it("ranks by total points, so stars can pull someone level with a bigger accepted count", () => {
    const standings = rankStandings([
      { accountId: "plain.near", acceptedCount: 3, starredCount: 0 },
      { accountId: "starry.near", acceptedCount: 2, starredCount: 2 },
      { accountId: "tied.near", acceptedCount: 3, starredCount: 0 },
    ]);
    expect(standings.map((s) => [s.accountId, s.points, s.rank])).toEqual([
      ["plain.near", 30, 1],
      ["tied.near", 30, 1],
      ["starry.near", 30, 1],
    ]);
  });

  it("orders equal points by accepted count, shares their rank and reports the bonus", () => {
    const standings = rankStandings([
      { accountId: "b.near", acceptedCount: 2, starredCount: 2 },
      { accountId: "a.near", acceptedCount: 3, starredCount: 0 },
      { accountId: "c.near", acceptedCount: 4, starredCount: 1 },
    ]);
    expect(standings).toEqual([
      {
        rank: 1,
        accountId: "c.near",
        points: 45,
        acceptedCount: 4,
        starredCount: 1,
        bonusPoints: 5,
      },
      {
        rank: 2,
        accountId: "a.near",
        points: 30,
        acceptedCount: 3,
        starredCount: 0,
        bonusPoints: 0,
      },
      {
        rank: 2,
        accountId: "b.near",
        points: 30,
        acceptedCount: 2,
        starredCount: 2,
        bonusPoints: 10,
      },
    ]);
  });

  it("clamps a starred count larger than the accepted count", () => {
    const [entry] = rankStandings([{ accountId: "x.near", acceptedCount: 1, starredCount: 7 }]);
    expect(entry).toMatchObject({ starredCount: 1, bonusPoints: 5, points: 15 });
  });
});
