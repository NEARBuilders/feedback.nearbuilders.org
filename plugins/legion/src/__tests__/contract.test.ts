import { describe, expect, it } from "vitest";
import { contract } from "../contract";

const schema = contract.checkAccess["~orpc"].inputSchema as {
  safeParse: (value: unknown) => { success: boolean };
};

describe("checkAccess input", () => {
  it("accepts named and implicit NEAR account ids", () => {
    expect(schema.safeParse({ nearAccountId: "alice.near" }).success).toBe(true);
    expect(schema.safeParse({ nearAccountId: "a".repeat(64) }).success).toBe(true);
  });

  it("rejects oversized or malformed account ids", () => {
    expect(schema.safeParse({ nearAccountId: "a".repeat(65) }).success).toBe(false);
    expect(schema.safeParse({ nearAccountId: "alice near" }).success).toBe(false);
    expect(schema.safeParse({ nearAccountId: "" }).success).toBe(false);
  });
});
