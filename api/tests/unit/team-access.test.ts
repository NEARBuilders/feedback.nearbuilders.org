import { describe, expect, it, vi } from "vitest";
import { createTeamAccess } from "@/services/team-access";

const context = { userId: "user-1" };

function authWith(handlers: { listTeams?: unknown; listTeamMembers?: unknown }) {
  return (() => handlers) as unknown as Parameters<typeof createTeamAccess>[0];
}

describe("createTeamAccess", () => {
  it("is disabled when the auth plugin is not available", async () => {
    const access = createTeamAccess(undefined, { warn: vi.fn() });
    expect(access.enabled).toBe(false);
    await expect(access.isMember(context, "team-1", "user-1")).resolves.toBe(false);
    await expect(access.listOrgTeamIds(context, "org-1")).resolves.toBeNull();
  });

  it("reports whether a user is on a team", async () => {
    const listTeamMembers = vi.fn().mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
    const access = createTeamAccess(authWith({ listTeamMembers }), { warn: vi.fn() });

    await expect(access.isMember(context, "team-1", "user-2")).resolves.toBe(true);
    await expect(access.isMember(context, "team-1", "user-9")).resolves.toBe(false);
    expect(listTeamMembers).toHaveBeenCalledWith({ teamId: "team-1" });
  });

  it("fails closed and warns when the membership lookup errors", async () => {
    const warn = vi.fn();
    const listTeamMembers = vi.fn().mockRejectedValue(new Error("auth down"));
    const access = createTeamAccess(authWith({ listTeamMembers }), { warn });

    await expect(access.isMember(context, "team-1", "user-1")).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("auth down");
  });

  it("lists an organization's team ids, or null when that fails", async () => {
    const listTeams = vi.fn().mockResolvedValue([{ id: "team-a" }, { id: "team-b" }]);
    const access = createTeamAccess(authWith({ listTeams }), { warn: vi.fn() });
    await expect(access.listOrgTeamIds(context, "org-1")).resolves.toEqual(["team-a", "team-b"]);
    expect(listTeams).toHaveBeenCalledWith({ organizationId: "org-1" });

    const failing = createTeamAccess(
      authWith({ listTeams: vi.fn().mockRejectedValue(new Error("nope")) }),
      { warn: vi.fn() },
    );
    await expect(failing.listOrgTeamIds(context, "org-1")).resolves.toBeNull();
  });
});
