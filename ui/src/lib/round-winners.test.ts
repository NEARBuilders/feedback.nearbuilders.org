import { describe, expect, it } from "vitest";
import { getRoundWinners } from "./round-winners";

describe("getRoundWinners", () => {
  it("returns the ranked top 10 for the nearly-trade campaign", () => {
    const winners = getRoundWinners("nearly-trade", 1);
    expect(winners).toHaveLength(10);
    expect(winners[0]).toBe("m1halich228.tg");
    expect(winners[9]).toBe("7178321377-hot.tg");
    expect(new Set(winners).size).toBe(10);
  });

  it("returns nothing for other rounds of the same project", () => {
    expect(getRoundWinners("nearly-trade", 2)).toEqual([]);
  });

  it("returns nothing for other projects", () => {
    expect(getRoundWinners("kinu", 1)).toEqual([]);
  });
});
