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

const PARTNER = { id: "partner-org-1", name: "NearlyTrade", slug: "nearlytrade", status: "active" };

async function ownedPrivateRound() {
  const n = ++counter;
  const owner = await getPluginClient(
    nearAuthedContext(
      `partner-owner-${n}.near`,
      `partner-owner-user-${n}`,
      `partner-owner-org-${n}`,
      "owner",
    ),
  );
  const round = await owner.createRound({
    projectSlug: `partner-project-${n}`,
    title: `Partner round ${n}`,
    description: "Co-managed round",
    formats: ["written"],
    isPrivate: true,
  });
  const admin = await getPluginClient(adminContext());
  if (round.status !== "open") await admin.approveProject({ id: round.projectRecordId });

  const tester = await getPluginClient(nearAuthedContext(`partner-tester-${n}.near`));
  await tester.joinRound({ id: round.id });
  await tester.postFeedback({
    id: round.id,
    format: "written",
    body: "Private finding",
  });
  return { n, owner, round };
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([]);
  authListOrganizations.mockReset();
  authListOrganizations.mockResolvedValue([PARTNER]);
});

describe("partner management (#279)", () => {
  it("adds a partner by slug; the partner org's members and org key gain access", async () => {
    const { owner, round } = await ownedPrivateRound();

    const project = await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });
    expect(project.partners).toEqual([{ organizationId: PARTNER.id, slug: PARTNER.slug }]);

    const partnerMember = await getPluginClient(
      nearAuthedContext("partner.near", "partner-user", PARTNER.id, "member"),
    );
    const updated = await partnerMember.updateRound({
      id: round.id,
      readme: "Updated by a partner member",
    });
    expect(updated.readme).toBe("Updated by a partner member");

    const key = await getPluginClient(orgKeyContext(PARTNER.id));
    expect((await key.listRounds({})).map((r) => r.id)).toContain(round.id);
    expect(await key.getRound({ id: round.id })).toMatchObject({ canManage: true });
    const { items } = await key.listFeedback({ id: round.id });
    expect(items.map((f) => f.body)).toEqual(["Private finding"]);
  });

  it("keeps other organizations' keys out of a partnered round", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });

    const outsider = await getPluginClient(orgKeyContext("some-other-org"));
    expect((await outsider.listFeedback({ id: round.id })).items).toEqual([]);
    expect(await outsider.getRound({ id: round.id })).toMatchObject({ canManage: false });
  });

  it("refuses partner members from joining as testers", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });

    const partnerMember = await getPluginClient(
      nearAuthedContext("partner.near", "partner-user", PARTNER.id, "member"),
    );
    await expect(partnerMember.joinRound({ id: round.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lets site admins add and remove partners", async () => {
    const { round } = await ownedPrivateRound();
    // Attributed writes need a linked wallet, same as feedback notes — admins included.
    const admin = await getPluginClient({
      ...adminContext("partner-admin-1"),
      near: {
        primaryAccountId: "partner-admin.near",
        hasNearAccount: true,
        linkedAccounts: [
          {
            accountId: "partner-admin.near",
            network: "mainnet",
            publicKey: "ed25519:test",
            isPrimary: true,
          },
        ],
      },
    });

    const project = await admin.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });
    expect(project.partners).toEqual([{ organizationId: PARTNER.id, slug: PARTNER.slug }]);

    const removed = await admin.removeProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });
    expect(removed.partners).toEqual([]);
  });

  it("refuses org keys on partner writes, like every other write", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });

    const key = await getPluginClient(orgKeyContext(PARTNER.id));
    await expect(
      key.addProjectPartner({ id: round.projectRecordId, organizationSlug: "another" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      key.removeProjectPartner({ id: round.projectRecordId, organizationSlug: "nearlytrade" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses partner members when they try to manage the partnership", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });

    const partnerMember = await getPluginClient(
      nearAuthedContext("partner.near", "partner-user", PARTNER.id, "member"),
    );
    await expect(
      partnerMember.addProjectPartner({ id: round.projectRecordId, organizationSlug: "another" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      partnerMember.removeProjectPartner({
        id: round.projectRecordId,
        organizationSlug: "nearlytrade",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed on unknown, unapproved, and self slugs", async () => {
    const { owner, round } = await ownedPrivateRound();

    authListOrganizations.mockResolvedValue([]);
    await expect(
      owner.addProjectPartner({ id: round.projectRecordId, organizationSlug: "nearlytrade" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    authListOrganizations.mockResolvedValue([{ ...PARTNER, status: "pending" }]);
    await expect(
      owner.addProjectPartner({ id: round.projectRecordId, organizationSlug: "nearlytrade" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    authListOrganizations.mockRejectedValue(new Error("auth plugin down"));
    await expect(
      owner.addProjectPartner({ id: round.projectRecordId, organizationSlug: "nearlytrade" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    authListOrganizations.mockResolvedValue([
      PARTNER,
      { id: `partner-owner-org-${counter}`, name: "self", slug: "self", status: "active" },
    ]);
    await expect(
      owner.addProjectPartner({ id: round.projectRecordId, organizationSlug: "self" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("removes a partner by slug; access ends on the next request", async () => {
    const { owner, round } = await ownedPrivateRound();
    await owner.addProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });

    const project = await owner.removeProjectPartner({
      id: round.projectRecordId,
      organizationSlug: "nearlytrade",
    });
    expect(project.partners).toEqual([]);

    const key = await getPluginClient(orgKeyContext(PARTNER.id));
    expect((await key.listFeedback({ id: round.id })).items).toEqual([]);

    await expect(
      owner.removeProjectPartner({
        id: round.projectRecordId,
        organizationSlug: "nearlytrade",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
