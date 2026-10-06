import { describe, expect, it } from "vitest";
import { oneOf } from "./search";

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
