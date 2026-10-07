import { describe, expect, it } from "vitest";
import { oneOf, positiveInt } from "./search";

const STATUSES = ["open", "closed"] as const;

describe("oneOf", () => {
  it("keeps an allowed value", () => {
    expect(oneOf("closed", STATUSES, "open")).toBe("closed");
  });

  it("falls back for unknown or missing values", () => {
    expect(oneOf("pending", STATUSES, "open")).toBe("open");
    expect(oneOf(undefined, STATUSES, "open")).toBe("open");
    expect(oneOf(3, STATUSES, "open")).toBe("open");
  });
});

describe("positiveInt", () => {
  it("parses positive integers only", () => {
    expect(positiveInt("3")).toBe(3);
    expect(positiveInt(2)).toBe(2);
    expect(positiveInt("0")).toBeNull();
    expect(positiveInt("2.5")).toBeNull();
    expect(positiveInt("latest")).toBeNull();
    expect(positiveInt(undefined)).toBeNull();
  });
});
