import { describe, expect, it } from "vitest";
import { acceptsFeedback, fromDateTimeLocal, toDateTimeLocal } from "./round-deadline";

const now = new Date("2026-10-10T12:00:00.000Z");

describe("acceptsFeedback", () => {
  it("accepts an open round with no deadline", () => {
    expect(acceptsFeedback({ status: "open", closesAt: null }, now)).toBe(true);
  });

  it("accepts until the deadline passes", () => {
    expect(acceptsFeedback({ status: "open", closesAt: "2026-10-11T00:00:00.000Z" }, now)).toBe(
      true,
    );
    expect(acceptsFeedback({ status: "open", closesAt: "2026-10-10T11:59:59.000Z" }, now)).toBe(
      false,
    );
  });

  it("never accepts on a round that isn't open", () => {
    expect(acceptsFeedback({ status: "closed", closesAt: null }, now)).toBe(false);
    expect(acceptsFeedback({ status: "pending", closesAt: null }, now)).toBe(false);
  });
});

describe("datetime-local conversion", () => {
  it("round-trips an instant through local time", () => {
    const iso = "2026-10-12T20:30:00.000Z";
    expect(fromDateTimeLocal(toDateTimeLocal(iso))).toBe(iso);
  });

  it("treats blank and invalid input as no deadline", () => {
    expect(toDateTimeLocal(null)).toBe("");
    expect(fromDateTimeLocal("")).toBeUndefined();
    expect(fromDateTimeLocal("nonsense")).toBeUndefined();
  });
});
