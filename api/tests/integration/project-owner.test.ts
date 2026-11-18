import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListOrganizations,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  nearAuthedContext,
} from "../setup";

let counter = 0;

/** What the host builds for an `org_…` key: an api key, an organization principal, no user. */
function orgKeyContext(organizationId: string): Record<string, unknown> {
  return {
    authType: "apiKey",
    apiKey: { id: `key-${organizationId}`, name: "org key", permissions: null },
    principal: { type: "organization", organizationId },
    organization: { activeOrganizationId: organizationId, organization: null },
    near: { primaryAccountId: null, linkedAccounts: [], hasNearAccount: false },
  };
}

const TARGET = { id: "partner-org-1", name: "NearlyTrade", slug: "nearlytrade", status: "active" };

async function ownedPrivateRound() {
  const n = ++counter;
  const owner = await getPluginClient(
    nearAuthedContext(
      `owner-move-${n}.near`,
      `owner-move-user-${n}`,
      `owner-move-org-${n}`,
      "owner",
    ),
  );
  const round = await owner.createRound({
    projectSlug: `owner-project-${n}`,
    title: `Ownership round ${n}`,
    description: "Ownership transfer round",
    formats: ["written"],
    isPrivate: true,
  });
  const admin = await getPluginClient(adminContext());
  if (round.status !== "open") await admin.approveProject({ id: round.projectRecordId });
  return { n, owner, round };
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([]);
  authListOrganizations.mockReset();
  authListOrganizations.mockResolvedValue([
    { id: "nearlegion-org-1", name: "NearLegion", slug: "nearlegion", status: "active" },
    TARGET,
  ]);
});

describe("project ownership transfer (#111 follow-up)", () => {
  it("lets a site admin move the project to another org, which gains management", async () => {
    const { round } = await ownedPrivateRound();

    const project = await getPluginClient(adminContext()).then((admin) =>
      admin.setProjectOwner({ id: round.projectRecordId, organizationSlug: TARGET.slug }),
    );
    expect(project.ownerOrgId).toBe(TARGET.id);

    const newOwner = await getPluginClient(
      nearAuthedContext("moved-owner.near", "moved-owner-user", TARGET.id, "owner"),
    );
    const updated = await newOwner.updateRound({
      id: round.id,
      readme: "Updated by the new org",
    });
    expect(updated.readme).toBe("Updated by the new org");
  });

  it("leaves the previous owner without management after the move", async () => {
    const { owner, round } = await ownedPrivateRound();

    const admin = await getPluginClient(adminContext());
    await admin.setProjectOwner({ id: round.projectRecordId, organizationSlug: TARGET.slug });

    await expect(
      owner.updateRound({ id: round.id, readme: "stale owner write" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets the project owner transfer without admin help", async () => {
    const { owner, round } = await ownedPrivateRound();

    const project = await owner.setProjectOwner({
      id: round.projectRecordId,
      organizationSlug: TARGET.slug,
    });
    expect(project.ownerOrgId).toBe(TARGET.id);
  });

  it("refuses callers who cannot manage the project", async () => {
    const { round } = await ownedPrivateRound();

    const outsider = await getPluginClient(
      nearAuthedContext("owner-outsider.near", "owner-outsider-user", TARGET.id, "member"),
    );
    await expect(
      outsider.setProjectOwner({ id: round.projectRecordId, organizationSlug: TARGET.slug }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses org keys, like every other write", async () => {
    const { round } = await ownedPrivateRound();

    const key = await getPluginClient(orgKeyContext(TARGET.id));
    await expect(
      key.setProjectOwner({ id: round.projectRecordId, organizationSlug: TARGET.slug }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unknown and unresolvable organization slugs", async () => {
    const { round } = await ownedPrivateRound();
    const admin = await getPluginClient(adminContext());

    await expect(
      admin.setProjectOwner({ id: round.projectRecordId, organizationSlug: "does-not-exist" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("clears the old org's team delegation on a cross-org move", async () => {
    const { owner, round } = await ownedPrivateRound();

    await owner.setProjectManagingTeam({ id: round.projectRecordId, teamId: "team-a" });
    const project = await getPluginClient(adminContext()).then((admin) =>
      admin.setProjectOwner({ id: round.projectRecordId, organizationSlug: TARGET.slug }),
    );
    expect(project.managingTeamId).toBeNull();

    const newOwner = await getPluginClient(
      nearAuthedContext("moved-owner.near", "moved-owner-user", TARGET.id, "member"),
    );
    const updated = await newOwner.updateRound({ id: round.id, readme: "member of the new org" });
    expect(updated.readme).toBe("member of the new org");
  });

  it("keeps partner grants working across the ownership move", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlegion",
    });

    const admin = await getPluginClient(adminContext());
    const project = await admin.setProjectOwner({
      id: round.projectRecordId,
      organizationSlug: TARGET.slug,
    });
    expect(project.ownerOrgId).toBe(TARGET.id);

    const partnerKey = await getPluginClient(orgKeyContext("nearlegion-org-1"));
    const { items } = await partnerKey.listFeedback({ id: round.id });
    expect(items).toHaveLength(0);
    expect(await partnerKey.getRound({ id: round.id })).toMatchObject({ canManage: true });
  });
});
