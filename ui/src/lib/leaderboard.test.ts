import { describe, expect, it } from "vitest";
import {
  filterStandings,
  isLeaderboardPeriod,
  leaderboardState,
  paginate,
  periodLabel,
  submissionsLabel,
} from "./leaderboard";

describe("leaderboard helpers", () => {
  it("recognises only the supported periods", () => {
    expect(isLeaderboardPeriod("weekly")).toBe(true);
    expect(isLeaderboardPeriod("monthly")).toBe(true);
    expect(isLeaderboardPeriod("all-time")).toBe(true);
    expect(isLeaderboardPeriod("daily")).toBe(false);
    expect(isLeaderboardPeriod(undefined)).toBe(false);
  });

  it("labels periods for display", () => {
    expect(periodLabel("weekly")).toBe("This week");
    expect(periodLabel("all-time")).toBe("All time");
  });

  it("pluralises submissions", () => {
    expect(submissionsLabel(1)).toBe("1 submission");
    expect(submissionsLabel(0)).toBe("0 submissions");
    expect(submissionsLabel(12)).toBe("12 submissions");
  });
});

describe("filterStandings", () => {
  const entries = [{ actor: "Alice.near" }, { actor: "bob.near" }, { actor: "alicia.near" }];

  it("returns everything for a blank query", () => {
    expect(filterStandings(entries, "   ")).toEqual(entries);
  });

  it("matches case-insensitively on the account id", () => {
    expect(filterStandings(entries, "ALI")).toEqual([
      { actor: "Alice.near" },
      { actor: "alicia.near" },
    ]);
    expect(filterStandings(entries, "zzz")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("slices a page and reports the page count", () => {
    expect(paginate(items, 1, 10)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      page: 1,
      pageCount: 3,
    });
    expect(paginate(items, 3, 10).items).toEqual([21, 22, 23]);
  });

  it("clamps out-of-range pages and handles an empty list", () => {
    expect(paginate(items, 99, 10).page).toBe(3);
    expect(paginate(items, 0, 10).page).toBe(1);
    expect(paginate([], 1, 10)).toEqual({ items: [], page: 1, pageCount: 1 });
  });
});

describe("leaderboardState", () => {
  const ok = { configured: true, available: true, data: [{}] };

  it("distinguishes unconfigured, unreachable, empty, no-match and ready", () => {
    expect(leaderboardState({ configured: false, available: false, data: [] }, 0)).toBe(
      "unconfigured",
    );
    expect(leaderboardState({ configured: true, available: false, data: [] }, 0)).toBe(
      "unreachable",
    );
    expect(leaderboardState({ configured: true, available: true, data: [] }, 0)).toBe("empty");
    expect(leaderboardState(ok, 0)).toBe("no-match");
    expect(leaderboardState(ok, 1)).toBe("ready");
  });
});
