import { describe, expect, it } from "vitest";
import { latestOpenRound } from "./latest-open-round";

const NOW = new Date("2026-11-15T12:00:00Z").getTime();

describe("latestOpenRound", () => {
  it("returns the highest-numbered open round", () => {
    const rounds = [
      { projectRoundNumber: 1, status: "open" as const },
      { projectRoundNumber: 3, status: "open" as const },
      { projectRoundNumber: 2, status: "open" as const },
    ];
    expect(latestOpenRound(rounds, NOW)?.projectRoundNumber).toBe(3);
  });

  it("skips closed rounds even when they are newer", () => {
    const rounds = [
      { projectRoundNumber: 1, status: "open" as const },
      { projectRoundNumber: 2, status: "closed" as const },
    ];
    expect(latestOpenRound(rounds, NOW)?.projectRoundNumber).toBe(1);
  });

  it("skips open rounds that already passed their end date", () => {
    const rounds = [
      { projectRoundNumber: 1, status: "open" as const, endsAt: "2027-01-01T00:00:00Z" },
      { projectRoundNumber: 2, status: "open" as const, endsAt: "2026-11-01T00:00:00Z" },
    ];
    expect(latestOpenRound(rounds, NOW)?.projectRoundNumber).toBe(1);
  });

  it("returns null when nothing is open", () => {
    expect(latestOpenRound([], NOW)).toBeNull();
    expect(latestOpenRound([{ projectRoundNumber: 1, status: "closed" as const }], NOW)).toBeNull();
  });
});
