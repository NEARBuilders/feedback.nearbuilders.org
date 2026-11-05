import { describe, expect, it, vi } from "vitest";
import { createLegionAccess, LEGION_MINT_URL } from "@/services/legion-access";

function legionWithHolders(holders: string[]) {
  const checkAccess = vi.fn(async ({ nearAccountId }: { nearAccountId: string }) => ({
    hasAccess: holders.includes(nearAccountId),
  }));
  const legion = { client: vi.fn().mockReturnValue({ checkAccess }) };
  return { legion: legion as never, checkAccess };
}

describe("getMyAccessAcross", () => {
  it("reports the linked account that holds the SBT, not just the primary", async () => {
    const { legion, checkAccess } = legionWithHolders(["linked.near"]);
    const access = createLegionAccess(legion, { warn: vi.fn() });

    await expect(access.getMyAccessAcross({}, ["primary.near", "linked.near"])).resolves.toEqual({
      hasAccess: true,
      linkedNearAccount: "linked.near",
      mintUrl: LEGION_MINT_URL,
    });
    expect(checkAccess).toHaveBeenCalledTimes(2);
  });

  it("stops at the first holder", async () => {
    const { legion, checkAccess } = legionWithHolders(["primary.near", "linked.near"]);
    const access = createLegionAccess(legion, { warn: vi.fn() });

    const result = await access.getMyAccessAcross({}, ["primary.near", "linked.near"]);
    expect(result.linkedNearAccount).toBe("primary.near");
    expect(checkAccess).toHaveBeenCalledTimes(1);
  });

  it("denies against the primary account when none of them hold one", async () => {
    const { legion } = legionWithHolders([]);
    const access = createLegionAccess(legion, { warn: vi.fn() });

    await expect(access.getMyAccessAcross({}, ["primary.near", "linked.near"])).resolves.toEqual({
      hasAccess: false,
      linkedNearAccount: "primary.near",
      mintUrl: LEGION_MINT_URL,
    });
  });

  it("denies when the caller has no linked account", async () => {
    const { legion } = legionWithHolders([]);
    const access = createLegionAccess(legion, { warn: vi.fn() });

    await expect(access.getMyAccessAcross({}, [])).resolves.toMatchObject({
      hasAccess: false,
      linkedNearAccount: null,
    });
  });
});
