import { describe, expect, it } from "vitest";
import { createOpenRound, freshSlug, joinWithFeedback } from "../fixtures";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

describe("listFeedback filters (#115)", () => {
  it("filters by status and author", async () => {
    const { round, ownerClient } = await createOpenRound("inbox-owner1.near");
    const { feedback: mine } = await joinWithFeedback(round.id, "inbox-a1.near", ["a1", "a2"]);
    await joinWithFeedback(round.id, "inbox-b1.near", ["b1"]);
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [mine[0]?.id ?? ""],
      status: "resolved",
    });

    const resolved = await ownerClient.listFeedback({ id: round.id, status: "resolved" });
    expect(resolved.items.map((f) => f.body)).toEqual(["a1"]);

    const byAuthor = await ownerClient.listFeedback({ id: round.id, author: "inbox-a1.near" });
    expect(byAuthor.items.map((f) => f.body)).toEqual(["a2", "a1"]);
  });

  it("hides a pending round's feedback from everyone but its managers", async () => {
    const owner = await getPluginClient(nearAuthedContext("inbox-owner2.near"));
    const pending = await owner.createRound({
      projectSlug: freshSlug("inbox-pending"),
      title: "Pending",
      description: "Not approved yet",
      formats: ["written"],
    });

    await expect((await getPluginClient()).listFeedback({ id: pending.id })).rejects.toThrow(
      "Round not found",
    );
    await expect(owner.listFeedback({ id: pending.id })).resolves.toMatchObject({ items: [] });
    await expect(
      (await getPluginClient(adminContext())).listFeedback({ id: pending.id }),
    ).resolves.toMatchObject({ items: [] });
  });
});

describe("getFeedback (#115)", () => {
  it("returns one feedback item of the round", async () => {
    const { round, ownerClient } = await createOpenRound("inbox-owner3.near");
    const { feedback } = await joinWithFeedback(round.id, "inbox-a3.near", ["**markdown**"]);

    const item = await ownerClient.getFeedback({ id: round.id, feedbackId: feedback[0]?.id ?? "" });
    expect(item).toMatchObject({ body: "**markdown**", authorAccountId: "inbox-a3.near" });
  });

  it("returns NOT_FOUND for feedback from another round", async () => {
    const a = await createOpenRound("inbox-owner4.near");
    const b = await createOpenRound("inbox-owner4.near");
    const { feedback } = await joinWithFeedback(b.round.id, "inbox-a4.near", ["elsewhere"]);

    await expect(
      a.ownerClient.getFeedback({ id: a.round.id, feedbackId: feedback[0]?.id ?? "" }),
    ).rejects.toThrow("Feedback not found");
  });
});
