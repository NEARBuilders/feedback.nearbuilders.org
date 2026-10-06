import { describe, expect, it } from "vitest";
import { canManageRound, isOrgAdminRole, needsTeamCheck } from "@/services/round-access";

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

describe("canManageRound with a managing team", () => {
  const project = { ownerOrgId: "org-1", managingTeamId: "team-1" };
  const inOrg = { activeOrganizationId: "org-1" };

  it("allows members of the managing team", () => {
    expect(
      canManageRound(round, project, { ...inOrg, orgRole: "member", inManagingTeam: true }),
    ).toBe(true);
  });

  it("denies other org members who are not on the team", () => {
    expect(canManageRound(round, project, { ...inOrg, orgRole: "member" })).toBe(false);
    expect(
      canManageRound(round, project, { ...inOrg, orgRole: "member", inManagingTeam: false }),
    ).toBe(false);
    expect(canManageRound(round, project, inOrg)).toBe(false);
  });

  it("always allows the org's owners and admins", () => {
    expect(canManageRound(round, project, { ...inOrg, orgRole: "owner" })).toBe(true);
    expect(canManageRound(round, project, { ...inOrg, orgRole: "admin" })).toBe(true);
  });

  it("never lets team membership cross organizations", () => {
    expect(
      canManageRound(round, project, {
        activeOrganizationId: "org-2",
        orgRole: "admin",
        inManagingTeam: true,
      }),
    ).toBe(false);
  });

  it("treats a project with no managing team like any org-owned project", () => {
    expect(canManageRound(round, { ownerOrgId: "org-1", managingTeamId: null }, inOrg)).toBe(true);
    expect(canManageRound(round, { ownerOrgId: "org-1" }, inOrg)).toBe(true);
  });
});

describe("needsTeamCheck", () => {
  const project = { ownerOrgId: "org-1", managingTeamId: "team-1" };

  it("only asks for team membership when it can change the answer", () => {
    expect(needsTeamCheck(project, { activeOrganizationId: "org-1", orgRole: "member" })).toBe(
      true,
    );
    expect(needsTeamCheck(project, { activeOrganizationId: "org-1" })).toBe(true);
    expect(needsTeamCheck(project, { activeOrganizationId: "org-1", orgRole: "admin" })).toBe(
      false,
    );
    expect(needsTeamCheck(project, { activeOrganizationId: "org-2", orgRole: "member" })).toBe(
      false,
    );
    expect(
      needsTeamCheck(
        { ownerOrgId: "org-1", managingTeamId: null },
        { activeOrganizationId: "org-1" },
      ),
    ).toBe(false);
    expect(needsTeamCheck(null, { activeOrganizationId: "org-1" })).toBe(false);
  });
});

describe("isOrgAdminRole", () => {
  it("recognises owners and admins only", () => {
    expect(isOrgAdminRole("owner")).toBe(true);
    expect(isOrgAdminRole("admin")).toBe(true);
    expect(isOrgAdminRole("member")).toBe(false);
    expect(isOrgAdminRole(null)).toBe(false);
    expect(isOrgAdminRole(undefined)).toBe(false);
  });
});
