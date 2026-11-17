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

/**
 * A personal `api_…` key acting as its user: the same context as that user's session, plus the
 * key. This assumes the host attaches the key owner's user to the request, which the host and
 * auth plugin decide, not this service. If that ever changes, this test is where it shows.
 */
function personalKeyContext(accountId: string): Record<string, unknown> {
  return {
    ...nearAuthedContext(accountId),
    authType: "apiKey",
    apiKey: { id: `key-${accountId}`, name: "tester key", permissions: null },
  };
}

async function openRound() {
  const n = ++counter;
  const orgId = `tkey-org-${n}`;
  const owner = await getPluginClient(
    nearAuthedContext(`tkey-owner-${n}.near`, `tkey-owner-user-${n}`, orgId, "owner"),
  );
  const round = await owner.createRound({
    projectSlug: `tkey-project-${n}`,
    title: `Tester keys ${n}`,
    description: "Agents can take part as testers.",
    formats: ["written"],
  });
  const admin = await getPluginClient(adminContext());
  if (round.status !== "open") await admin.approveProject({ id: round.projectRecordId });
  return { n, orgId, round };
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([]);
});

describe("a tester's agent taking part with a key (#298)", () => {
  it("lets a personal key with a linked NEAR account join and post", async () => {
    const { n, round } = await openRound();
    const agent = await getPluginClient(personalKeyContext(`tkey-agent-${n}.near`));

    await agent.joinRound({ id: round.id });
    const posted = await agent.postFeedback({
      id: round.id,
      format: "written",
      body: "Found a bug while testing as an agent",
    });
    expect(posted).toMatchObject({ roundId: round.id, status: "unresolved" });
  });

  it("refuses to post before joining, like the UI", async () => {
    const { n, round } = await openRound();
    const agent = await getPluginClient(personalKeyContext(`tkey-late-${n}.near`));
    await expect(
      agent.postFeedback({ id: round.id, format: "written", body: "Never joined" }),
    ).rejects.toBeTruthy();
  });

  it("never lets an organization key join a round", async () => {
    const { orgId, round } = await openRound();
    const key = await getPluginClient(orgKeyContext(orgId));
    await expect(key.joinRound({ id: round.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("never lets an organization key post feedback", async () => {
    const { orgId, round } = await openRound();
    const key = await getPluginClient(orgKeyContext(orgId));
    await expect(
      key.postFeedback({ id: round.id, format: "written", body: "Posted as the org" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
