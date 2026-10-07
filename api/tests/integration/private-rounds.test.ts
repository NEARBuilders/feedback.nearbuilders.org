import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  nearAuthedContext,
  nostrCreateComment,
} from "../setup";

let counter = 0;

async function privateRound(extra: { legionOnly?: boolean } = {}) {
  const n = ++counter;
  const orgId = `priv-org-${n}`;
  const asOwner = nearAuthedContext(`priv-owner-${n}.near`, `priv-owner-user-${n}`, orgId, "owner");
  const owner = await getPluginClient(asOwner);
  const round = await owner.createRound({
    projectSlug: `private-project-${n}`,
    title: `Private ${n}`,
    description: "Feedback stays inside the team.",
    formats: ["written", "recorded"],
    isPrivate: true,
    ...extra,
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, orgId, round, owner, asOwner };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return client.postFeedback({ id: roundId, format: "written", body });
}

beforeEach(() => {
  nostrCreateComment.mockClear();
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }]);
  authListTeamMembers.mockResolvedValue([{ userId: "teamed-user" }]);
});

describe("private rounds (#101)", () => {
  it("creates private rounds and lets managers toggle the flag afterwards", async () => {
    const { round, owner } = await privateRound();
    expect(round.isPrivate).toBe(true);

    const opened = await owner.updateRoundSettings({ id: round.id, isPrivate: false });
    expect(opened.isPrivate).toBe(false);
    const closedAgain = await owner.updateRoundSettings({ id: round.id, isPrivate: true });
    expect(closedAgain.isPrivate).toBe(true);
  });

  it("refuses the settings change to everyone who can't manage the round", async () => {
    const { round } = await privateRound();
    const outsider = await getPluginClient(nearAuthedContext("priv-outsider.near"));
    await expect(outsider.updateRoundSettings({ id: round.id, isPrivate: false })).rejects.toThrow(
      "Only the round owner",
    );
    const anon = await getPluginClient();
    await expect(anon.updateRoundSettings({ id: round.id, isPrivate: false })).rejects.toThrow();
  });

  it("shows the managing org and platform admins every submission", async () => {
    const { round, owner } = await privateRound();
    await post("priv-a.near", round.id, "Secret bug A");
    await post("priv-b.near", round.id, "Secret bug B");

    const all = await owner.listFeedback({ id: round.id });
    expect(all.map((f) => f.body).sort()).toEqual(["Secret bug A", "Secret bug B"]);

    const admin = await getPluginClient(adminContext());
    expect(await admin.listFeedback({ id: round.id })).toHaveLength(2);
  });

  it("shows a participant only their own submissions", async () => {
    const { round } = await privateRound();
    await post("priv-c.near", round.id, "Mine");
    await post("priv-d.near", round.id, "Theirs");

    const c = await getPluginClient(nearAuthedContext("priv-c.near"));
    const own = await c.listFeedback({ id: round.id });
    expect(own.map((f) => f.body)).toEqual(["Mine"]);
  });

  it("hides every body and author from signed-out and unrelated callers", async () => {
    const { round } = await privateRound();
    await post("priv-e.near", round.id, "Hidden body");

    const anon = await getPluginClient();
    expect(await anon.listFeedback({ id: round.id })).toEqual([]);

    const stranger = await getPluginClient(nearAuthedContext("priv-stranger.near"));
    expect(await stranger.listFeedback({ id: round.id })).toEqual([]);

    const otherOrgMember = await getPluginClient(
      nearAuthedContext("priv-rival.near", "priv-rival-user", "some-other-org", "owner"),
    );
    expect(await otherOrgMember.listFeedback({ id: round.id })).toEqual([]);
  });

  it("keeps public rounds readable by everyone", async () => {
    const { round, owner } = await privateRound();
    await owner.updateRoundSettings({ id: round.id, isPrivate: false });
    await post("priv-f.near", round.id, "Public body");
    const anon = await getPluginClient();
    expect((await anon.listFeedback({ id: round.id })).map((f) => f.body)).toEqual(["Public body"]);
  });

  it("exposes only metadata, three avatars and the submission count on the public surface", async () => {
    const { round } = await privateRound();
    for (const who of ["p1", "p2", "p3", "p4"]) {
      await post(`priv-${who}.near`, round.id, `from ${who}`);
    }
    const anon = await getPluginClient();
    const surface = await anon.getRound({ id: round.id });
    expect(surface).toMatchObject({
      title: round.title,
      isPrivate: true,
      participantCount: 4,
      feedbackCount: 4,
    });
    expect(surface.participantPreview).toEqual(["priv-p1.near", "priv-p2.near", "priv-p3.near"]);
    expect(JSON.stringify(surface)).not.toContain("from p1");
  });

  it("follows the team rule when the project is delegated to a team", async () => {
    const { round, orgId, owner } = await privateRound();
    await post("priv-g.near", round.id, "Team only");
    await owner.setProjectManagingTeam({ id: round.projectRecordId, teamId: "team-a" });

    const teamed = await getPluginClient(
      nearAuthedContext("priv-teamed.near", "teamed-user", orgId, "member"),
    );
    expect(await teamed.listFeedback({ id: round.id })).toHaveLength(1);

    const otherMember = await getPluginClient(
      nearAuthedContext("priv-plain.near", "plain-user", orgId, "member"),
    );
    expect(await otherMember.listFeedback({ id: round.id })).toEqual([]);

    // org owners and admins keep access
    expect(await owner.listFeedback({ id: round.id })).toHaveLength(1);
  });

  it("lets participants still join and post, without reading each other", async () => {
    const { round } = await privateRound();
    const tester = await getPluginClient(nearAuthedContext("priv-tester.near"));
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "Still allowed" }),
    ).resolves.toMatchObject({ body: "Still allowed" });
  });

  it("never publishes private-round feedback to nostr", async () => {
    const { round, owner } = await privateRound();
    const fb = await post("priv-nostr.near", round.id, "Not for relays");
    expect(fb.nostrEventId).toBeNull();
    expect(nostrCreateComment).not.toHaveBeenCalled();

    await owner.updateRoundSettings({ id: round.id, isPrivate: false });
    const publicFb = await post("priv-nostr-2.near", round.id, "Fine for relays");
    expect(publicFb.nostrEventId).toBe("test-nostr-event");
    expect(nostrCreateComment).toHaveBeenCalledTimes(1);
  });

  it("doesn't let a stranger read feedback through status or delete responses", async () => {
    const { round } = await privateRound();
    const fb = await post("priv-h.near", round.id, "Guarded");
    const stranger = await getPluginClient(nearAuthedContext("priv-stranger-2.near"));
    await expect(
      stranger.setFeedbackStatus({ id: round.id, feedbackIds: [fb.id], status: "resolved" }),
    ).rejects.toThrow();
    await expect(stranger.deleteFeedback({ id: round.id, feedbackId: fb.id })).rejects.toThrow();
  });

  it("hides credits (who posted) on a closed private round from outsiders", async () => {
    const { round, owner } = await privateRound();
    await post("priv-cred.near", round.id, "Credited quietly");
    await owner.closeRound({
      id: round.id,
      credits: [{ builderAccountId: "priv-cred.near", contributedMeaningfully: true }],
    });

    expect(await owner.listRoundCredits({ id: round.id })).toHaveLength(1);
    const anon = await getPluginClient();
    expect(await anon.listRoundCredits({ id: round.id })).toEqual([]);
    const stranger = await getPluginClient(nearAuthedContext("priv-stranger-3.near"));
    expect(await stranger.listRoundCredits({ id: round.id })).toEqual([]);
    const credited = await getPluginClient(nearAuthedContext("priv-cred.near"));
    expect(await credited.listRoundCredits({ id: round.id })).toHaveLength(1);
  });
});
