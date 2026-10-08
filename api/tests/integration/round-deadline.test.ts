import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function openRound(closesAt?: string) {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`dl-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `dl-project-${n}`,
    title: `Deadline ${n}`,
    description: "Feedback stops at the deadline.",
    formats: ["written"],
    ...(closesAt ? { closesAt } : {}),
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, owner, round };
}

async function join(account: string, roundId: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return client;
}

describe("round deadline", () => {
  it("has no deadline unless one is set", async () => {
    const { round } = await openRound();
    expect(round.closesAt).toBeNull();
  });

  it("stores a deadline given at creation and accepts feedback before it", async () => {
    const closesAt = inHours(24);
    const { round } = await openRound(closesAt);
    expect(round.closesAt).toBe(closesAt);

    const tester = await join("dl-tester-1.near", round.id);
    const feedback = await tester.postFeedback({ id: round.id, format: "written", body: "early" });
    expect(feedback.body).toBe("early");
  });

  it("rejects a deadline in the past at creation", async () => {
    const owner = await getPluginClient(nearAuthedContext("dl-owner-past.near"));
    await expect(
      owner.createRound({
        projectSlug: "dl-project-past",
        title: "Past",
        description: "Too late already.",
        formats: ["written"],
        closesAt: inHours(-1),
      }),
    ).rejects.toThrow(/validation failed/i);
  });

  it("stops posting, editing and author deletes once the deadline passes", async () => {
    const { owner, round } = await openRound(inHours(24));
    const tester = await join("dl-tester-2.near", round.id);
    const feedback = await tester.postFeedback({ id: round.id, format: "written", body: "first" });

    await owner.updateRoundSettings({ id: round.id, closesAt: inHours(-1) });

    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "second" }),
    ).rejects.toThrow(/no longer accepting/);
    await expect(
      tester.editFeedback({ id: round.id, feedbackId: feedback.id, body: "edited" }),
    ).rejects.toThrow(/closed/);
    await expect(tester.deleteFeedback({ id: round.id, feedbackId: feedback.id })).rejects.toThrow(
      /closed/,
    );

    // The round itself stays open for the owner to close and award credits.
    const detail = await owner.getRound({ id: round.id });
    expect(detail.status).toBe("open");
    await expect(owner.closeRound({ id: round.id })).resolves.toMatchObject({ status: "closed" });
  });

  it("lets the owner extend or clear the deadline to reopen submissions", async () => {
    const { owner, round } = await openRound(inHours(24));
    const tester = await join("dl-tester-3.near", round.id);
    await owner.updateRoundSettings({ id: round.id, closesAt: inHours(-1) });
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "blocked" }),
    ).rejects.toThrow();

    const extended = await owner.updateRoundSettings({ id: round.id, closesAt: inHours(48) });
    expect(extended.closesAt).not.toBeNull();
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "back on" }),
    ).resolves.toMatchObject({ body: "back on" });

    const cleared = await owner.updateRoundSettings({ id: round.id, closesAt: null });
    expect(cleared.closesAt).toBeNull();
  });

  it("only lets the owner change the deadline", async () => {
    const { round } = await openRound();
    const other = await getPluginClient(nearAuthedContext("dl-stranger.near"));
    await expect(
      other.updateRoundSettings({ id: round.id, closesAt: inHours(1) }),
    ).rejects.toThrow();
  });
});
