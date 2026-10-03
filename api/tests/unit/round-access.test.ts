import { describe, expect, it } from "vitest";
import { canManageRound } from "@/services/round-access";

const round = { ownerAccountId: "creator.near" };

describe("canManageRound", () => {
  it("allows members of the project's owning org, whoever created the round", () => {
    expect(canManageRound(round, { ownerOrgId: "org-1" }, { activeOrganizationId: "org-1" })).toBe(
      true,
    );
  });

  it("denies other orgs, even for the round's original creator", () => {
    expect(
      canManageRound(
        round,
        { ownerOrgId: "org-1" },
        { activeOrganizationId: "org-2", accountId: "creator.near" },
      ),
    ).toBe(false);
  });

  it("denies callers with no active org when the project has an owning org", () => {
    expect(canManageRound(round, { ownerOrgId: "org-1" }, { accountId: "creator.near" })).toBe(
      false,
    );
    expect(canManageRound(round, { ownerOrgId: "org-1" }, {})).toBe(false);
  });

  it("falls back to the round creator for projects with no owning org yet", () => {
    expect(canManageRound(round, { ownerOrgId: null }, { accountId: "creator.near" })).toBe(true);
    expect(canManageRound(round, null, { accountId: "creator.near" })).toBe(true);
    expect(canManageRound(round, { ownerOrgId: null }, { accountId: "someone.near" })).toBe(false);
    expect(canManageRound(round, { ownerOrgId: null }, {})).toBe(false);
  });
});
