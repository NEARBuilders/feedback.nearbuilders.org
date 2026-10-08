import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`edit-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `edit-project-${n}`,
    title: `Edit ${n}`,
    description: "Edit your feedback.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { owner, round };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return { client, feedback: await client.postFeedback({ id: roundId, format: "written", body }) };
}

describe("editFeedback", () => {
  it("lets the author change the body and stamps updatedAt", async () => {
    const { round } = await openRound();
    const { client, feedback } = await post("edit-tester-1.near", round.id, "first draft");
    expect(feedback.updatedAt).toBeNull();

    const edited = await client.editFeedback({
      id: round.id,
      feedbackId: feedback.id,
      body: "  second draft  ",
    });

    expect(edited.body).toBe("second draft");
    expect(edited.updatedAt).not.toBeNull();
    expect(edited.createdAt).toBe(feedback.createdAt);
  });

  it("rejects an empty body", async () => {
    const { round } = await openRound();
    const { client, feedback } = await post("edit-tester-2.near", round.id, "keep me");

    await expect(
      client.editFeedback({ id: round.id, feedbackId: feedback.id, body: "   " }),
    ).rejects.toThrow(/non-empty body/);
  });

  it("only lets the author edit", async () => {
    const { owner, round } = await openRound();
    const { feedback } = await post("edit-tester-3.near", round.id, "mine");
    const other = await getPluginClient(nearAuthedContext("edit-tester-4.near"));

    await expect(
      other.editFeedback({ id: round.id, feedbackId: feedback.id, body: "hijack" }),
    ).rejects.toThrow(/Only the author/);
    await expect(
      owner.editFeedback({ id: round.id, feedbackId: feedback.id, body: "hijack" }),
    ).rejects.toThrow(/Only the author/);
  });

  it("refuses edits once the round is closed", async () => {
    const { owner, round } = await openRound();
    const { client, feedback } = await post("edit-tester-5.near", round.id, "before close");
    await owner.closeRound({ id: round.id });

    await expect(
      client.editFeedback({ id: round.id, feedbackId: feedback.id, body: "too late" }),
    ).rejects.toThrow(/closed/);
  });
});
