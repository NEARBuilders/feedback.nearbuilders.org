import { describe, expect, it } from "vitest";
import {
  canManageProject,
  canManageRound,
  canReadAllFeedback,
  filterVisibleFeedback,
  isOrgAdminRole,
  needsTeamCheck,
} from "@/services/round-access";

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

describe("canManageProject (#119)", () => {
  const rounds = [round, { ownerAccountId: "second.near" }];

  it("follows the owning org and its managing team", () => {
    const project = { ownerOrgId: "org-1", managingTeamId: "team-1", rounds };
    expect(canManageProject(project, { activeOrganizationId: "org-1", orgRole: "admin" })).toBe(
      true,
    );
    expect(canManageProject(project, { activeOrganizationId: "org-1", inManagingTeam: true })).toBe(
      true,
    );
    expect(canManageProject(project, { activeOrganizationId: "org-1" })).toBe(false);
  });

  it("falls back to the creator of any of its rounds when no org owns it yet", () => {
    const project = { ownerOrgId: null, rounds };
    expect(canManageProject(project, { accountId: "second.near" })).toBe(true);
    expect(canManageProject(project, { accountId: "someone.near" })).toBe(false);
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

describe("canReadAllFeedback (#101)", () => {
  const publicRound = { ownerAccountId: "creator.near", isPrivate: false };
  const privateRound = { ownerAccountId: "creator.near", isPrivate: true };
  const project = { ownerOrgId: "org-1" };

  it("lets everyone read a public round, even signed-out callers", () => {
    expect(canReadAllFeedback(publicRound, project, {}, false)).toBe(true);
  });

  it("limits a private round to its managers and admins", () => {
    expect(
      canReadAllFeedback(privateRound, project, { activeOrganizationId: "org-1" }, false),
    ).toBe(true);
    expect(canReadAllFeedback(privateRound, project, {}, true)).toBe(true);
    expect(
      canReadAllFeedback(privateRound, project, { activeOrganizationId: "org-2" }, false),
    ).toBe(false);
    expect(canReadAllFeedback(privateRound, project, {}, false)).toBe(false);
  });

  it("follows the team rule when the project is delegated to a team", () => {
    const delegated = { ownerOrgId: "org-1", managingTeamId: "team-1" };
    const inOrg = { activeOrganizationId: "org-1" };
    expect(canReadAllFeedback(privateRound, delegated, inOrg, false)).toBe(false);
    expect(
      canReadAllFeedback(privateRound, delegated, { ...inOrg, inManagingTeam: true }, false),
    ).toBe(true);
    expect(canReadAllFeedback(privateRound, delegated, { ...inOrg, orgRole: "admin" }, false)).toBe(
      true,
    );
  });

  it("falls back to the round creator when the project has no owning org", () => {
    expect(
      canReadAllFeedback(privateRound, { ownerOrgId: null }, { accountId: "creator.near" }, false),
    ).toBe(true);
    expect(
      canReadAllFeedback(privateRound, { ownerOrgId: null }, { accountId: "other.near" }, false),
    ).toBe(false);
  });
});

describe("filterVisibleFeedback (#101)", () => {
  const items = [
    { id: "1", authorAccountId: "a.near" },
    { id: "2", authorAccountId: "b.near" },
    { id: "3", authorAccountId: "a.near" },
  ];

  it("returns everything when the caller can read all", () => {
    expect(filterVisibleFeedback(items, true, null)).toEqual(items);
  });

  it("keeps only the caller's own submissions otherwise", () => {
    expect(filterVisibleFeedback(items, false, ["a.near"]).map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterVisibleFeedback(items, false, ["nobody.near"])).toEqual([]);
  });

  it("keeps submissions from any of the caller's linked wallets (#121)", () => {
    expect(filterVisibleFeedback(items, false, ["nobody.near", "b.near"]).map((i) => i.id)).toEqual(
      ["2"],
    );
  });

  it("returns nothing to signed-out callers", () => {
    expect(filterVisibleFeedback(items, false, null)).toEqual([]);
    expect(filterVisibleFeedback(items, false, undefined)).toEqual([]);
    expect(filterVisibleFeedback(items, false, [])).toEqual([]);
  });
});
