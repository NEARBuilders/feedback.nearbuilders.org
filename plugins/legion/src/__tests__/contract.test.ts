import { describe, expect, it } from "vitest";
import { contract } from "../contract";

/**
 * The merged contract exposes the input validator at `~orpc.inputSchemas[0]`
 * — the first schema in the input chain (see api contract test conventions).
 */
function parseInput(route: { "~orpc": { inputSchemas?: readonly unknown[] } }, input: unknown) {
  const schema = route["~orpc"].inputSchemas?.[0] as
    | {
        safeParse: (value: unknown) => { success: boolean };
      }
    | undefined;
  return schema ? schema.safeParse(input) : { success: true, data: input };
}

describe("checkAccess input", () => {
  it("accepts named and implicit NEAR account ids", () => {
    expect(parseInput(contract.checkAccess, { nearAccountId: "alice.near" }).success).toBe(true);
    expect(parseInput(contract.checkAccess, { nearAccountId: "a".repeat(64) }).success).toBe(true);
  });

  it("rejects oversized or malformed account ids", () => {
    expect(parseInput(contract.checkAccess, { nearAccountId: "a".repeat(65) }).success).toBe(false);
    expect(parseInput(contract.checkAccess, { nearAccountId: "alice near" }).success).toBe(false);
    expect(parseInput(contract.checkAccess, { nearAccountId: "" }).success).toBe(false);
  });
});
