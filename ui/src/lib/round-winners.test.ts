import { describe, expect, it } from "vitest";
import { parseRoundOverviewPath, parseWinnersInput } from "./round-winners";

describe("parseRoundOverviewPath", () => {
  it("matches only the round overview page", () => {
    expect(parseRoundOverviewPath("/projects/nearly-trade/1")).toEqual({
      slug: "nearly-trade",
      number: 1,
    });
    expect(parseRoundOverviewPath("/projects/nearly-trade/1/")).toEqual({
      slug: "nearly-trade",
      number: 1,
    });
  });

  it("ignores the round's other pages and other routes", () => {
    expect(parseRoundOverviewPath("/projects/nearly-trade/1/feedback")).toBeNull();
    expect(parseRoundOverviewPath("/projects/nearly-trade")).toBeNull();
    expect(parseRoundOverviewPath("/manage/nearly-trade/1")).toBeNull();
    expect(parseRoundOverviewPath("/")).toBeNull();
  });
});

describe("parseWinnersInput", () => {
  it("keeps the owner's order, trims, and drops blanks and duplicates", () => {
    expect(parseWinnersInput(" alice.near\n\nbob.tg , alice.near\ncarol.near ")).toEqual([
      "alice.near",
      "bob.tg",
      "carol.near",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseWinnersInput("  \n ")).toEqual([]);
  });
});
