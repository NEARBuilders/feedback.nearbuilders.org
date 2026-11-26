import { describe, expect, it, vi } from "vitest";
import { createOrgMembershipAccess } from "@/services/org-membership";

const context = { userId: "user-1" };

function authWith(getActiveMember: unknown) {
  return { client: () => ({ getActiveMember }) } as unknown as Parameters<
    typeof createOrgMembershipAccess
  >[0];
}

describe("createOrgMembershipAccess (#291)", () => {
  it("is not a member of no organizations, without a lookup", async () => {
    const getActiveMember = vi.fn();
    const access = createOrgMembershipAccess(authWith(getActiveMember), { warn: vi.fn() });
    await expect(access.checkMembership(context, [])).resolves.toBe("not-member");
    expect(getActiveMember).not.toHaveBeenCalled();
  });

  it("reports membership when any listed organization has the caller as a member", async () => {
    const getActiveMember = vi.fn(async ({ organizationId }: { organizationId: string }) =>
      organizationId === "org-2"
        ? { id: "member-1", role: "member", organizationId }
        : { id: null, role: null, organizationId: null },
    );
    const access = createOrgMembershipAccess(authWith(getActiveMember), { warn: vi.fn() });

    await expect(access.checkMembership(context, ["org-1", "org-2"])).resolves.toBe("member");
    expect(getActiveMember).toHaveBeenCalledWith({ organizationId: "org-1" });
    expect(getActiveMember).toHaveBeenCalledWith({ organizationId: "org-2" });
  });

  it("ignores a member of another organization returned for the requested one", async () => {
    const getActiveMember = vi
      .fn()
      .mockResolvedValue({ id: "member-9", role: "member", organizationId: "other-org" });
    const access = createOrgMembershipAccess(authWith(getActiveMember), { warn: vi.fn() });

    await expect(access.checkMembership(context, ["org-1"])).resolves.toBe("not-member");
  });

  it("reports not-member when none of the organizations has the caller", async () => {
    const getActiveMember = vi
      .fn()
      .mockResolvedValue({ id: null, role: null, organizationId: null });
    const access = createOrgMembershipAccess(authWith(getActiveMember), { warn: vi.fn() });
    await expect(access.checkMembership(context, ["org-1"])).resolves.toBe("not-member");
  });

  it("fails closed and warns when the lookup errors", async () => {
    const warn = vi.fn();
    const getActiveMember = vi.fn().mockRejectedValue(new Error("auth down"));
    const access = createOrgMembershipAccess(authWith(getActiveMember), { warn });
    await expect(access.checkMembership(context, ["org-1"])).resolves.toBe("unverifiable");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("is unverifiable when the auth plugin is not available", async () => {
    const access = createOrgMembershipAccess(undefined, { warn: vi.fn() });
    await expect(access.checkMembership(context, ["org-1"])).resolves.toBe("unverifiable");
  });
});
