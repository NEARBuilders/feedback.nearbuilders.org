import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let slugCounter = 0;

async function openRound(owner: string) {
  const ownerClient = await getPluginClient(nearAuthedContext(owner));
  const round = await ownerClient.createRound({
    projectSlug: `points-project-${++slugCounter}`,
    title: `Points ${owner}`,
    description: "Try it and tell us what you find.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { round, ownerClient };
}

async function post(tester: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(tester));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return client.postFeedback({ id: roundId, format: "written", body });
}

describe("points for accepted feedback", () => {
  it("starts everyone at zero with no rank", async () => {
    const client = await getPluginClient();
    await expect(client.getBuilderPoints({ accountId: "nobody-pts.near" })).resolves.toEqual({
      accountId: "nobody-pts.near",
      points: 0,
      acceptedCount: 0,
      submittedCount: 0,
      rank: null,
    });
  });

  it("awards points only when the owner accepts (resolves) feedback", async () => {
    const { round, ownerClient } = await openRound("pts1-owner.near");
    const a = await post("pts1-tester.near", round.id, "Accepted one");
    const b = await post("pts1-tester.near", round.id, "Accepted two");
    const dismissed = await post("pts1-tester.near", round.id, "Dismissed");
    await post("pts1-tester.near", round.id, "Never reviewed");

    const anon = await getPluginClient();
    const before = await anon.getBuilderPoints({ accountId: "pts1-tester.near" });
    expect(before).toMatchObject({ points: 0, acceptedCount: 0, submittedCount: 4, rank: null });

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [a.id, b.id],
      status: "resolved",
    });
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [dismissed.id],
      status: "dismissed",
    });

    const after = await anon.getBuilderPoints({ accountId: "pts1-tester.near" });
    expect(after).toMatchObject({ points: 20, acceptedCount: 2, submittedCount: 4 });
    expect(after.rank).toEqual(expect.any(Number));
  });

  it("takes the points back when accepted feedback is reopened or dismissed", async () => {
    const { round, ownerClient } = await openRound("pts2-owner.near");
    const item = await post("pts2-tester.near", round.id, "Changes its mind");
    const anon = await getPluginClient();

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "resolved",
    });
    expect((await anon.getBuilderPoints({ accountId: "pts2-tester.near" })).points).toBe(10);

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "unresolved",
    });
    expect((await anon.getBuilderPoints({ accountId: "pts2-tester.near" })).points).toBe(0);

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "resolved",
    });
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "dismissed",
    });
    expect((await anon.getBuilderPoints({ accountId: "pts2-tester.near" })).points).toBe(0);
  });

  it("does not double count when feedback is accepted twice", async () => {
    const { round, ownerClient } = await openRound("pts3-owner.near");
    const item = await post("pts3-tester.near", round.id, "Accepted twice");
    for (let i = 0; i < 2; i++) {
      await ownerClient.setFeedbackStatus({
        id: round.id,
        feedbackIds: [item.id],
        status: "resolved",
      });
    }
    const anon = await getPluginClient();
    expect(await anon.getBuilderPoints({ accountId: "pts3-tester.near" })).toMatchObject({
      points: 10,
      acceptedCount: 1,
    });
  });

  it("ranks the leaderboard by points, shares rank on ties and honours the limit", async () => {
    const { round, ownerClient } = await openRound("pts4-owner.near");
    const ids: Record<string, string[]> = {
      "pts4-top.near": [],
      "pts4-b.near": [],
      "pts4-c.near": [],
    };
    for (const [tester, count] of [
      ["pts4-top.near", 3],
      ["pts4-b.near", 1],
      ["pts4-c.near", 1],
    ] as const) {
      for (let i = 0; i < count; i++) {
        ids[tester]?.push((await post(tester, round.id, `${tester} ${i}`)).id);
      }
    }
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: Object.values(ids).flat(),
      status: "resolved",
    });

    const anon = await getPluginClient();
    const board = await anon.getPointsLeaderboard({ period: "all-time" });
    expect(board.pointsPerAcceptedFeedback).toBe(10);
    const mine = board.data.filter((entry) => entry.actor.startsWith("pts4-"));
    expect(mine).toEqual([
      expect.objectContaining({ actor: "pts4-top.near", points: 30, acceptedCount: 3 }),
      expect.objectContaining({ actor: "pts4-b.near", points: 10, acceptedCount: 1 }),
      expect.objectContaining({ actor: "pts4-c.near", points: 10, acceptedCount: 1 }),
    ]);
    expect(mine[1]?.rank).toBe(mine[2]?.rank);
    expect(mine[0]?.rank).toBeLessThan(mine[1]?.rank ?? 0);

    const limited = await anon.getPointsLeaderboard({ period: "all-time", limit: 1 });
    expect(limited.data).toHaveLength(1);
  });

  it("counts freshly accepted feedback in the weekly and monthly boards", async () => {
    const { round, ownerClient } = await openRound("pts5-owner.near");
    const item = await post("pts5-tester.near", round.id, "Fresh");
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "resolved",
    });

    const anon = await getPluginClient();
    for (const period of ["weekly", "monthly", "all-time"] as const) {
      const board = await anon.getPointsLeaderboard({ period });
      expect(board.period).toBe(period);
      expect(board.data.find((entry) => entry.actor === "pts5-tester.near")?.points).toBe(10);
    }
  });

  it("only reports people with accepted feedback", async () => {
    const { round } = await openRound("pts6-owner.near");
    await post("pts6-tester.near", round.id, "Unreviewed only");
    const anon = await getPluginClient();
    const board = await anon.getPointsLeaderboard({ period: "all-time" });
    expect(board.data.find((entry) => entry.actor === "pts6-tester.near")).toBeUndefined();
  });

  it("drops points when the round is deleted", async () => {
    const { round, ownerClient } = await openRound("pts7-owner.near");
    const item = await post("pts7-tester.near", round.id, "Soon gone");
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [item.id],
      status: "resolved",
    });
    await ownerClient.deleteRound({ id: round.id });

    const anon = await getPluginClient();
    expect(await anon.getBuilderPoints({ accountId: "pts7-tester.near" })).toMatchObject({
      points: 0,
      acceptedCount: 0,
      submittedCount: 0,
    });
  });
});

describe("points can't be farmed by the owning organization", () => {
  it("stops members of the project's organization joining its rounds as testers", async () => {
    const { round } = await openRound("pts8-owner.near");
    const teammate = await getPluginClient(
      nearAuthedContext("pts8-teammate.near", "pts8-teammate-user", "org-of-pts8-owner.near"),
    );
    await expect(teammate.joinRound({ id: round.id })).rejects.toThrow("organization runs");
    await expect(
      teammate.postFeedback({ id: round.id, format: "written", body: "Self-serving" }),
    ).rejects.toThrow("Join the round");
  });

  it("still lets people from other organizations join", async () => {
    const { round } = await openRound("pts9-owner.near");
    const tester = await getPluginClient(nearAuthedContext("pts9-tester.near"));
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
  });
});
