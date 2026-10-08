import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
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

async function privateRound() {
  const n = ++counter;
  const orgId = `okey-org-${n}`;
  const owner = await getPluginClient(
    nearAuthedContext(`okey-owner-${n}.near`, `okey-owner-user-${n}`, orgId, "owner"),
  );
  const round = await owner.createRound({
    projectSlug: `okey-project-${n}`,
    title: `Org key ${n}`,
    description: "Read me over an API key.",
    formats: ["written"],
    isPrivate: true,
  });
  const admin = await getPluginClient(adminContext());
  if (round.status !== "open") await admin.approveProject({ id: round.projectRecordId });

  const tester = await getPluginClient(nearAuthedContext(`okey-tester-${n}.near`));
  await tester.joinRound({ id: round.id });
  const feedback = await tester.postFeedback({
    id: round.id,
    format: "written",
    body: "Private finding",
  });
  return { n, orgId, owner, round, feedback };
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([]);
});

describe("organization API keys (#111)", () => {
  it("reads its organization's rounds and private feedback", async () => {
    const { orgId, round } = await privateRound();
    const key = await getPluginClient(orgKeyContext(orgId));

    const listed = await key.listRounds({});
    expect(listed.map((r) => r.id)).toContain(round.id);

    const detail = await key.getRound({ id: round.id });
    expect(detail).toMatchObject({ id: round.id, canManage: true });

    const { items } = await key.listFeedback({ id: round.id });
    expect(items.map((f) => f.body)).toEqual(["Private finding"]);
  });

  it("bypasses team delegation like an org admin", async () => {
    const { orgId, owner, round } = await privateRound();
    await owner.setProjectManagingTeam({ id: round.projectRecordId, teamId: "team-a" });
    const key = await getPluginClient(orgKeyContext(orgId));
    expect((await key.listFeedback({ id: round.id })).items).toHaveLength(1);
  });

  it("is denied for projects owned by other organizations", async () => {
    const { round } = await privateRound();
    const other = await getPluginClient(orgKeyContext("someone-elses-org"));

    expect((await other.listFeedback({ id: round.id })).items).toEqual([]);
    expect(await other.getRound({ id: round.id })).toMatchObject({ canManage: false });
  });

  it("lists only its own organization's pending rounds", async () => {
    const n = ++counter;
    const orgId = `okey-pending-org-${n}`;
    const owner = await getPluginClient(
      nearAuthedContext(`okey-pending-${n}.near`, `okey-pending-user-${n}`, orgId, "owner"),
    );
    const pending = await owner.createRound({
      projectSlug: `okey-pending-project-${n}`,
      title: "Waiting for approval",
      description: "Pending.",
      formats: ["written"],
    });
    expect(pending.status).toBe("pending");

    const own = await getPluginClient(orgKeyContext(orgId));
    expect((await own.listRounds({ status: "pending" })).map((r) => r.id)).toContain(pending.id);

    const other = await getPluginClient(orgKeyContext("another-org"));
    expect((await other.listRounds({ status: "pending" })).map((r) => r.id)).not.toContain(
      pending.id,
    );
  });

  it("can't write anything", async () => {
    const { orgId, round, feedback } = await privateRound();
    const key = await getPluginClient(orgKeyContext(orgId));

    await expect(
      key.setFeedbackStatus({ id: round.id, feedbackIds: [feedback.id], status: "resolved" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      key.setFeedbackStarred({ id: round.id, feedbackIds: [feedback.id], starred: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      key.deleteFeedback({ id: round.id, feedbackId: feedback.id }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(key.closeRound({ id: round.id, credits: [] })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(key.deleteRound({ id: round.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(key.updateRoundSettings({ id: round.id, isPrivate: false })).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("leaves personal sessions alone: a plain anonymous caller still sees nothing private", async () => {
    const { round } = await privateRound();
    const anon = await getPluginClient();
    expect((await anon.listFeedback({ id: round.id })).items).toEqual([]);
  });
});
