import { describe, expect, it } from "vitest";
import { isRoundExpired } from "@/services/round-liveness";

const now = Date.parse("2026-11-07T12:00:00.000Z");

describe("isRoundExpired", () => {
  it("is false with no end time", () => {
    expect(isRoundExpired({ endsAt: null }, now)).toBe(false);
  });
  it("is false before the end time", () => {
    expect(isRoundExpired({ endsAt: "2026-11-07T12:00:01.000Z" }, now)).toBe(false);
  });
  it("is true at and after the end time", () => {
    expect(isRoundExpired({ endsAt: "2026-11-07T12:00:00.000Z" }, now)).toBe(true);
    expect(isRoundExpired({ endsAt: "2026-11-01T00:00:00.000Z" }, now)).toBe(true);
  });
});
