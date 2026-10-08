import { describe, expect, it } from "vitest";
import { adminContext, authedContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

/** An approved project with one open round, owned by `accountId`'s org. */
async function openRoundFor(accountId: string) {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(accountId));
  const round = await owner.createRound({
    projectSlug: `owner-summary-${n}`,
    title: `Round ${n}`,
    description: "Summary coverage",
    formats: ["written"],
  });
  const admin = await getPluginClient(adminContext());
  await admin.approveProject({ id: round.projectRecordId });
  return { owner, round };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId });
  return client.postFeedback({ id: roundId, format: "written", body });
}

describe("getOwnerSummary", () => {
  it("rejects unauthenticated requests", async () => {
    const client = await getPluginClient();
    await expect(client.getOwnerSummary()).rejects.toThrow("Authentication required");
  });

  it("rejects a signed-in user with no active organization", async () => {
    const client = await getPluginClient(authedContext());
    await expect(client.getOwnerSummary()).rejects.toThrow("Active organization required");
  });

  it("returns zeros for an org that owns nothing", async () => {
    const client = await getPluginClient(nearAuthedContext("owner-empty.near"));
    expect(await client.getOwnerSummary()).toEqual({
      openRounds: 0,
      unresolvedFeedback: 0,
      pendingProjects: 0,
    });
  });

  it("counts open rounds and unresolved feedback for the caller's org only", async () => {
    const { owner, round } = await openRoundFor("owner-summary1.near");
    await post("tester-a.near", round.id, "one");
    const resolved = await post("tester-b.near", round.id, "two");
    await owner.setFeedbackStatus({ id: round.id, feedbackIds: [resolved.id], status: "resolved" });

    const summary = await owner.getOwnerSummary();
    expect(summary).toEqual({ openRounds: 1, unresolvedFeedback: 1, pendingProjects: 0 });
  });

  it("excludes resolved and dismissed feedback from the unresolved count", async () => {
    const { owner, round } = await openRoundFor("owner-summary2.near");
    const a = await post("tester-c.near", round.id, "resolve me");
    const b = await post("tester-c.near", round.id, "dismiss me");
    await post("tester-c.near", round.id, "leave me unresolved");
    await owner.setFeedbackStatus({ id: round.id, feedbackIds: [a.id], status: "resolved" });
    await owner.setFeedbackStatus({ id: round.id, feedbackIds: [b.id], status: "dismissed" });

    expect(await owner.getOwnerSummary()).toMatchObject({ unresolvedFeedback: 1 });
  });

  it("counts a pending project awaiting admin approval", async () => {
    const owner = await getPluginClient(nearAuthedContext("owner-summary3.near"));
    await owner.createRound({
      projectSlug: "owner-summary-pending",
      title: "Not approved yet",
      description: "Still waiting",
      formats: ["written"],
    });

    expect(await owner.getOwnerSummary()).toEqual({
      openRounds: 0,
      unresolvedFeedback: 0,
      pendingProjects: 1,
    });
  });

  it("never counts another organization's rounds or feedback", async () => {
    const { round } = await openRoundFor("owner-summary4.near");
    await post("tester-d.near", round.id, "belongs to a different org");

    const stranger = await getPluginClient(nearAuthedContext("owner-summary5.near"));
    expect(await stranger.getOwnerSummary()).toEqual({
      openRounds: 0,
      unresolvedFeedback: 0,
      pendingProjects: 0,
    });
  });

  it("counts every open round and its feedback across multiple projects in the org", async () => {
    const orgId = "shared-org";
    const owner = await getPluginClient(
      nearAuthedContext("owner-summary6.near", "owner-summary6-user", orgId),
    );
    const first = await owner.createRound({
      projectSlug: "owner-summary-multi-a",
      title: "First",
      description: "First project",
      formats: ["written"],
    });
    const second = await owner.createRound({
      projectSlug: "owner-summary-multi-b",
      title: "Second",
      description: "Second project",
      formats: ["written"],
    });
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: first.projectRecordId });
    await admin.approveProject({ id: second.projectRecordId });

    await post("tester-e.near", first.id, "on the first project");
    await post("tester-f.near", second.id, "on the second project");

    expect(await owner.getOwnerSummary()).toEqual({
      openRounds: 2,
      unresolvedFeedback: 2,
      pendingProjects: 0,
    });
  });
});
