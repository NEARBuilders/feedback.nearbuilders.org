import { describe, expect, it } from "vitest";
import { clientFor, createOpenRound, joinWithFeedback } from "../fixtures";
import { getPluginClient } from "../setup";

async function feedbackKinds(accountId: string) {
  const { items } = await (await clientFor(accountId)).listNotifications({});
  return items.map((item) => item.kind).filter((kind) => kind.startsWith("feedback_"));
}

describe("resolve/dismiss notifications (#118)", () => {
  it("notifies each author once per bulk action", async () => {
    const { round, ownerClient } = await createOpenRound("note-owner1.near");
    const a = await joinWithFeedback(round.id, "note-a1.near", ["a1", "a2"]);
    const b = await joinWithFeedback(round.id, "note-b1.near", ["b1"]);

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [...a.feedback, ...b.feedback].map((f) => f.id),
      status: "resolved",
    });

    expect(await feedbackKinds("note-a1.near")).toEqual(["feedback_resolved"]);
    expect(await feedbackKinds("note-b1.near")).toEqual(["feedback_resolved"]);
  });

  it("doesn't notify again for items already in that status", async () => {
    const { round, ownerClient } = await createOpenRound("note-owner2.near");
    const { feedback } = await joinWithFeedback(round.id, "note-a2.near", ["a"]);
    const dismiss = {
      id: round.id,
      feedbackIds: [feedback[0]?.id ?? ""],
      status: "dismissed" as const,
    };

    await ownerClient.setFeedbackStatus(dismiss);
    await ownerClient.setFeedbackStatus(dismiss);

    expect(await feedbackKinds("note-a2.near")).toEqual(["feedback_dismissed"]);
  });
});

describe("feedback notes (#118)", () => {
  it("shows the owner's note to the author, who can reply", async () => {
    const { round, ownerClient } = await createOpenRound("note-owner3.near");
    const { client, feedback } = await joinWithFeedback(round.id, "note-a3.near", ["bug?"]);
    const feedbackId = feedback[0]?.id ?? "";

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [feedbackId],
      status: "dismissed",
      note: "Works as intended",
    });
    const [mine] = await client.listMyFeedback({ id: round.id });
    expect(mine?.notes.map((n) => [n.role, n.body])).toEqual([["owner", "Works as intended"]]);

    await client.addFeedbackNote({ id: round.id, feedbackId, body: "It still breaks on mobile" });
    const detail = await ownerClient.getFeedback({ id: round.id, feedbackId });
    expect(detail.notes.map((n) => [n.role, n.authorAccountId])).toEqual([
      ["owner", "note-owner3.near"],
      ["tester", "note-a3.near"],
    ]);
  });

  it("lets testers reply but not start a thread", async () => {
    const { round } = await createOpenRound("note-owner4.near");
    const { client, feedback } = await joinWithFeedback(round.id, "note-a4.near", ["hi"]);
    await expect(
      client.addFeedbackNote({ id: round.id, feedbackId: feedback[0]?.id ?? "", body: "hello?" }),
    ).rejects.toThrow("reply");
  });

  it("keeps notes from everyone but the author and the round's managers", async () => {
    const { round, ownerClient } = await createOpenRound("note-owner5.near");
    const { feedback } = await joinWithFeedback(round.id, "note-a5.near", ["x"]);
    const feedbackId = feedback[0]?.id ?? "";
    await ownerClient.addFeedbackNote({ id: round.id, feedbackId, body: "Private to you" });

    const anon = await getPluginClient();
    expect((await anon.getFeedback({ id: round.id, feedbackId })).notes).toEqual([]);
    const other = await clientFor("note-other5.near");
    await expect(
      other.addFeedbackNote({ id: round.id, feedbackId, body: "me too" }),
    ).rejects.toThrow("round owner");
  });
});
