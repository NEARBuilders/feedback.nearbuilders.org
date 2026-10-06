import { describe, expect, it } from "vitest";
import { clientFor, createOpenRound, freshSlug, joinWithFeedback } from "../fixtures";
import { getPluginClient, nearAuthedContext } from "../setup";

describe("getRoundBySlug (#114)", () => {
  it("resolves a round by project slug and round number", async () => {
    const { round } = await createOpenRound("url-owner1.near", { title: "Readable" });
    await joinWithFeedback(round.id, "url-tester1.near");

    const anon = await getPluginClient();
    const bySlug = await anon.getRoundBySlug({
      slug: round.projectSlug,
      number: round.projectRoundNumber,
    });

    expect(bySlug).toMatchObject({ id: round.id, title: "Readable", participantCount: 1 });
    expect(bySlug.canManage).toBe(false);
  });

  it("tells the managing org it can manage the round", async () => {
    const { round, ownerClient } = await createOpenRound("url-owner2.near");
    const bySlug = await ownerClient.getRoundBySlug({
      slug: round.projectSlug,
      number: round.projectRoundNumber,
    });
    expect(bySlug.canManage).toBe(true);
  });

  it("returns NOT_FOUND for a round number that doesn't exist", async () => {
    const { round } = await createOpenRound("url-owner3.near");
    const anon = await getPluginClient();
    await expect(anon.getRoundBySlug({ slug: round.projectSlug, number: 99 })).rejects.toThrow(
      "Round not found",
    );
  });

  it("hides a pending round from everyone but its managers", async () => {
    const owner = await getPluginClient(nearAuthedContext("url-owner4.near"));
    const pending = await owner.createRound({
      projectSlug: freshSlug("url-pending"),
      title: "Pending",
      description: "Not approved yet",
      formats: ["written"],
    });
    const ref = { slug: pending.projectSlug, number: pending.projectRoundNumber };

    await expect((await getPluginClient()).getRoundBySlug(ref)).rejects.toThrow("Round not found");
    await expect(owner.getRoundBySlug(ref)).resolves.toMatchObject({ status: "pending" });
  });
});

describe("round links carry slug and number (#114)", () => {
  it("lists joined rounds with their project round number", async () => {
    const { round } = await createOpenRound("url-owner5.near");
    const { client } = await joinWithFeedback(round.id, "url-tester5.near");

    const [joined] = await client.listMyJoinedRounds();
    expect(joined).toMatchObject({
      roundId: round.id,
      projectSlug: round.projectSlug,
      projectRoundNumber: round.projectRoundNumber,
    });
  });

  it("includes slug and number on notifications", async () => {
    const { round, ownerClient } = await createOpenRound("url-owner6.near");
    await joinWithFeedback(round.id, "url-tester6.near");
    await ownerClient.broadcastToRound({ id: round.id, kind: "round_closing" });

    const tester = await clientFor("url-tester6.near");
    const { items } = await tester.listNotifications({});
    expect(items[0]).toMatchObject({
      roundId: round.id,
      projectSlug: round.projectSlug,
      projectRoundNumber: round.projectRoundNumber,
    });
  });
});

describe("listFeedback pages (#114)", () => {
  it("pages newest first and follows the cursor to the end", async () => {
    const { round } = await createOpenRound("url-owner7.near");
    const { feedback } = await joinWithFeedback(round.id, "url-tester7.near", ["a", "b", "c"]);
    const anon = await getPluginClient();

    const first = await anon.listFeedback({ id: round.id, limit: 2 });
    expect(first.items.map((f) => f.body)).toEqual(["c", "b"]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await anon.listFeedback({
      id: round.id,
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.items.map((f) => f.id)).toEqual([feedback[0]?.id]);
    expect(second.nextCursor).toBeNull();
  });
});
