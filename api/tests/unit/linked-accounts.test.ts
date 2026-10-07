import { describe, expect, it } from "vitest";
import { actingAccountId, linkedAccountIds } from "@/services/linked-accounts";
import { actorOwnsAccount, canManageRound } from "@/services/round-access";

describe("linkedAccountIds (#121)", () => {
  it("lists the primary account first, then the other linked ones, without duplicates", () => {
    expect(
      linkedAccountIds({
        near: {
          primaryAccountId: "b.near",
          linkedAccounts: [
            { accountId: "a.near" },
            { accountId: "b.near" },
            { accountId: "c.near" },
          ],
        },
      }),
    ).toEqual(["b.near", "a.near", "c.near"]);
  });

  it("copes with missing or empty NEAR context", () => {
    expect(linkedAccountIds({})).toEqual([]);
    expect(linkedAccountIds({ near: null })).toEqual([]);
    expect(linkedAccountIds({ near: { primaryAccountId: null, linkedAccounts: [{}] } })).toEqual(
      [],
    );
    expect(linkedAccountIds({ near: { primaryAccountId: "a.near" } })).toEqual(["a.near"]);
  });
});

describe("actingAccountId (#121)", () => {
  it("acts as the primary account by default", () => {
    expect(actingAccountId(["b.near", "a.near"], null)).toBe("b.near");
  });

  it("keeps acting as the linked account that already holds the participation", () => {
    expect(actingAccountId(["b.near", "a.near"], "a.near")).toBe("a.near");
  });

  it("ignores a participation that isn't one of the caller's accounts", () => {
    expect(actingAccountId(["b.near"], "stranger.near")).toBe("b.near");
    expect(actingAccountId([], null)).toBeNull();
  });
});

describe("ownership matches any linked account (#121)", () => {
  const round = { ownerAccountId: "old-wallet.near" };

  it("recognises the primary and every other linked account", () => {
    const actor = {
      accountId: "new-wallet.near",
      accountIds: ["new-wallet.near", "old-wallet.near"],
    };
    expect(actorOwnsAccount(actor, "new-wallet.near")).toBe(true);
    expect(actorOwnsAccount(actor, "old-wallet.near")).toBe(true);
    expect(actorOwnsAccount(actor, "other.near")).toBe(false);
  });

  it("keeps the round-creator fallback working after switching primary wallet", () => {
    const actor = {
      accountId: "new-wallet.near",
      accountIds: ["new-wallet.near", "old-wallet.near"],
    };
    expect(canManageRound(round, { ownerOrgId: null }, actor)).toBe(true);
    expect(canManageRound(round, null, actor)).toBe(true);
    expect(canManageRound(round, { ownerOrgId: null }, { accountId: "new-wallet.near" })).toBe(
      false,
    );
    expect(canManageRound(round, { ownerOrgId: null }, {})).toBe(false);
  });
});
