import { describe, expect, it } from "vitest";
import { isRoundAcceptingFeedback, isRoundExpired } from "./round-expiry";

const now = Date.parse("2026-10-23T12:00:00.000Z");

describe("isRoundExpired", () => {
  it("treats an open round past its end as expired", () => {
    expect(isRoundExpired({ status: "open", endsAt: "2026-10-23T11:59:59.000Z" }, now)).toBe(true);
    expect(isRoundExpired({ status: "open", endsAt: "2026-10-23T12:00:00.000Z" }, now)).toBe(true);
  });

  it("keeps an open round with a future or missing end running", () => {
    expect(isRoundExpired({ status: "open", endsAt: "2026-10-24T00:00:00.000Z" }, now)).toBe(false);
    expect(isRoundExpired({ status: "open", endsAt: null }, now)).toBe(false);
  });

  it("only applies to open rounds", () => {
    expect(isRoundExpired({ status: "closed", endsAt: "2026-10-01T00:00:00.000Z" }, now)).toBe(
      false,
    );
  });
});

describe("isRoundAcceptingFeedback", () => {
  it("is false once the round expires or closes", () => {
    expect(
      isRoundAcceptingFeedback({ status: "open", endsAt: "2026-10-01T00:00:00.000Z" }, now),
    ).toBe(false);
    expect(isRoundAcceptingFeedback({ status: "closed", endsAt: null }, now)).toBe(false);
  });

  it("is true for an open, unexpired round", () => {
    expect(isRoundAcceptingFeedback({ status: "open", endsAt: null }, now)).toBe(true);
    expect(
      isRoundAcceptingFeedback({ status: "open", endsAt: "2026-10-24T00:00:00.000Z" }, now),
    ).toBe(true);
  });
});
