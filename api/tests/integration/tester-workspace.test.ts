import { describe, expect, it } from "vitest";
import { clientFor, createOpenRound, joinWithFeedback } from "../fixtures";
import { getPluginClient } from "../setup";

describe("listMyFeedback (#117)", () => {
  it("lists only the caller's feedback with status and points", async () => {
    const { round, ownerClient } = await createOpenRound("ws-owner1.near");
    const { client, feedback } = await joinWithFeedback(round.id, "ws-tester1.near", [
      "one",
      "two",
    ]);
    await joinWithFeedback(round.id, "ws-other1.near", ["not mine"]);
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [feedback[0]?.id ?? ""],
      status: "resolved",
    });

    const mine = await client.listMyFeedback({ id: round.id });
    expect(mine.map((f) => [f.body, f.status, f.points])).toEqual([
      ["two", "unresolved", 0],
      ["one", "resolved", 10],
    ]);
  });

  it("requires sign-in", async () => {
    const { round } = await createOpenRound("ws-owner2.near");
    await expect((await getPluginClient()).listMyFeedback({ id: round.id })).rejects.toThrow(
      "Authentication required",
    );
  });
});

describe("authors delete their own feedback (#117)", () => {
  it("lets the author delete while the round is open", async () => {
    const { round } = await createOpenRound("ws-owner3.near");
    const { client, feedback } = await joinWithFeedback(round.id, "ws-tester3.near", ["oops"]);

    await client.deleteFeedback({ id: round.id, feedbackId: feedback[0]?.id ?? "" });
    expect(await client.listMyFeedback({ id: round.id })).toEqual([]);
  });

  it("stops the author once the round is closed", async () => {
    const { round, ownerClient } = await createOpenRound("ws-owner4.near");
    const { feedback } = await joinWithFeedback(round.id, "ws-tester4.near", ["late"]);
    await ownerClient.closeRound({ id: round.id });

    const author = await clientFor("ws-tester4.near");
    await expect(
      author.deleteFeedback({ id: round.id, feedbackId: feedback[0]?.id ?? "" }),
    ).rejects.toThrow("closed");
  });

  it("doesn't let one tester delete another's feedback", async () => {
    const { round } = await createOpenRound("ws-owner5.near");
    const { feedback } = await joinWithFeedback(round.id, "ws-tester5.near", ["mine"]);
    const { client: other } = await joinWithFeedback(round.id, "ws-other5.near");

    await expect(
      other.deleteFeedback({ id: round.id, feedbackId: feedback[0]?.id ?? "" }),
    ).rejects.toThrow("owner");
  });
});
