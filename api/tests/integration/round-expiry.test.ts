import { beforeEach, describe, expect, it } from "vitest";
import { adminContext, getPluginClient, legionCheckAccess, nearAuthedContext } from "../setup";

let counter = 0;

async function openRound(input: { endsAt?: string } = {}) {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`expiry-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `expiry-project-${n}`,
    title: `Expiry ${n}`,
    description: "Ends on a timer.",
    formats: ["written"],
    ...input,
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { round, owner };
}

beforeEach(() => {
  legionCheckAccess.mockReset();
  legionCheckAccess.mockResolvedValue({ hasAccess: true });
});

describe("round expiration (#128)", () => {
  it("stores the expiration time on creation and reports it", async () => {
    const endsAt = new Date(Date.now() + 60_000).toISOString();
    const { round } = await openRound({ endsAt });
    expect(round.endsAt).toBe(endsAt);
  });

  it("blocks joining and posting once the round has expired", async () => {
    const { round, owner } = await openRound({
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const tester = await getPluginClient(nearAuthedContext("expiry-late.near"));
    await owner.updateRoundSettings({
      id: round.id,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(tester.joinRound({ id: round.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await owner.updateRoundSettings({ id: round.id, endsAt: null });
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
  });

  it("lets the owner extend or clear the expiration", async () => {
    const { round, owner } = await openRound({
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const extended = new Date(Date.now() + 120_000).toISOString();
    expect((await owner.updateRoundSettings({ id: round.id, endsAt: extended })).endsAt).toBe(
      extended,
    );
    expect((await owner.updateRoundSettings({ id: round.id, endsAt: null })).endsAt).toBeNull();
  });

  it("blocks posting feedback after expiry, even for a joined tester", async () => {
    const { round, owner } = await openRound({
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const tester = await getPluginClient(nearAuthedContext("expiry-joined.near"));
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
    await owner.updateRoundSettings({
      id: round.id,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "Too late" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("blocks editing submitted feedback after expiry, and allows it again if extended", async () => {
    const { round, owner } = await openRound({
      endsAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const tester = await getPluginClient(nearAuthedContext("expiry-editor.near"));
    await tester.joinRound({ id: round.id });
    const feedback = await tester.postFeedback({
      id: round.id,
      format: "written",
      body: "Original",
    });
    await owner.updateRoundSettings({
      id: round.id,
      endsAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(
      tester.editFeedback({ id: round.id, feedbackId: feedback.id, body: "Too late" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "This round has expired" });

    await owner.updateRoundSettings({ id: round.id, endsAt: null });
    await expect(
      tester.editFeedback({ id: round.id, feedbackId: feedback.id, body: "Back in time" }),
    ).resolves.toMatchObject({ id: feedback.id });
  });

  describe.each([
    [
      "expired",
      async (owner: Awaited<ReturnType<typeof getPluginClient>>, id: string) => {
        await owner.updateRoundSettings({ id, endsAt: new Date(Date.now() - 1000).toISOString() });
      },
    ],
    [
      "closed",
      async (owner: Awaited<ReturnType<typeof getPluginClient>>, id: string) => {
        await owner.closeRound({ id });
      },
    ],
  ])("reviewing feedback once the round is %s", (_label, end) => {
    it("still lets the owner open, note, star and resolve it", async () => {
      const { round, owner } = await openRound({
        endsAt: new Date(Date.now() + 60_000).toISOString(),
      });
      const tester = await getPluginClient(nearAuthedContext(`expiry-review-${++counter}.near`));
      await tester.joinRound({ id: round.id });
      const feedback = await tester.postFeedback({
        id: round.id,
        format: "written",
        body: "Review me later",
      });
      await end(owner, round.id);

      await expect(
        owner.getFeedback({ id: round.id, feedbackId: feedback.id }),
      ).resolves.toMatchObject({ id: feedback.id });
      await expect(
        owner.addFeedbackNote({ id: round.id, feedbackId: feedback.id, body: "Thanks" }),
      ).resolves.toMatchObject({ role: "owner" });
      await expect(
        owner.setFeedbackStarred({ id: round.id, feedbackIds: [feedback.id], starred: true }),
      ).resolves.toBeDefined();
      await expect(
        owner.setFeedbackStatus({ id: round.id, feedbackIds: [feedback.id], status: "resolved" }),
      ).resolves.toHaveLength(1);
    });
  });
});
