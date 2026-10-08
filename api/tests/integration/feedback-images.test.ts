import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  getPluginClient,
  nearAuthedContext,
  storageAttachByUrls,
  storageContexts,
  storageDeleteByOwner,
} from "../setup";

let counter = 0;

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`img-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `img-project-${n}`,
    title: `Images ${n}`,
    description: "Attach screenshots.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, owner, round };
}

async function post(account: string, roundId: string, body: string) {
  const client = await getPluginClient(nearAuthedContext(account));
  await client.joinRound({ id: roundId }).catch(() => undefined);
  return { client, feedback: await client.postFeedback({ id: roundId, format: "written", body }) };
}

beforeEach(() => {
  storageAttachByUrls.mockReset();
  storageAttachByUrls.mockResolvedValue({ attached: 1 });
  storageDeleteByOwner.mockReset();
  storageDeleteByOwner.mockResolvedValue({ deleted: 1 });
  storageContexts.length = 0;
});

describe("feedback images", () => {
  it("links the images in a posted body to the feedback, as the author", async () => {
    const { round } = await openRound();
    const body = "Broken ![shot](https://cdn.test/img/a.png)";
    const { feedback } = await post("img-tester-1.near", round.id, body);

    expect(feedback.body).toBe(body);
    expect(storageAttachByUrls).toHaveBeenCalledWith({
      ownerId: feedback.id,
      urls: ["https://cdn.test/img/a.png"],
    });
    expect(storageContexts.at(-1)).toMatchObject({
      near: { primaryAccountId: "img-tester-1.near" },
    });
  });

  it("doesn't call storage for feedback without images", async () => {
    const { round } = await openRound();
    await post("img-tester-2.near", round.id, "Just words");
    expect(storageAttachByUrls).not.toHaveBeenCalled();
  });

  it("still posts the feedback when linking the images fails", async () => {
    storageAttachByUrls.mockRejectedValue(new Error("storage down"));
    const { round } = await openRound();
    const { feedback } = await post("img-tester-3.near", round.id, "![x](https://cdn.test/b.png)");
    expect(feedback.id).toEqual(expect.any(String));
  });

  it("deletes a feedback item's images when its author removes it", async () => {
    const { round } = await openRound();
    const { client, feedback } = await post(
      "img-tester-4.near",
      round.id,
      "![x](https://cdn.test/c.png)",
    );

    await client.deleteFeedback({ id: round.id, feedbackId: feedback.id });

    expect(storageDeleteByOwner).toHaveBeenCalledWith({ ownerId: feedback.id });
    expect(storageContexts.at(-1)).toMatchObject({
      near: { primaryAccountId: "img-tester-4.near" },
    });
  });

  it("deletes the images as the author even when a manager removes the feedback", async () => {
    const { owner, round } = await openRound();
    const { feedback } = await post("img-tester-5.near", round.id, "![x](https://cdn.test/d.png)");

    await owner.deleteFeedback({ id: round.id, feedbackId: feedback.id });

    expect(storageDeleteByOwner).toHaveBeenCalledWith({ ownerId: feedback.id });
    expect(storageContexts.at(-1)).toMatchObject({
      near: { primaryAccountId: "img-tester-5.near" },
    });
  });

  it("still removes the feedback when the image cleanup fails", async () => {
    storageDeleteByOwner.mockRejectedValue(new Error("R2 unavailable"));
    const { owner, round } = await openRound();
    const { feedback } = await post("img-tester-6.near", round.id, "![x](https://cdn.test/e.png)");

    await expect(
      owner.deleteFeedback({ id: round.id, feedbackId: feedback.id }),
    ).resolves.toMatchObject({
      id: feedback.id,
    });
    expect((await owner.listFeedback({ id: round.id })).items).toEqual([]);
  });

  it("cleans up the images of every feedback item when a round is deleted", async () => {
    const { owner, round } = await openRound();
    const first = await post("img-tester-7.near", round.id, "![x](https://cdn.test/f.png)");
    const second = await post("img-tester-8.near", round.id, "![x](https://cdn.test/g.png)");

    await owner.deleteRound({ id: round.id });

    const owners = storageDeleteByOwner.mock.calls.map(([input]) => input.ownerId);
    expect(owners.sort()).toEqual([first.feedback.id, second.feedback.id].sort());
  });

  it("doesn't touch storage when the removal is refused", async () => {
    const { round } = await openRound();
    const { feedback } = await post("img-tester-9.near", round.id, "![x](https://cdn.test/h.png)");
    const stranger = await getPluginClient(nearAuthedContext("img-stranger.near"));

    await expect(
      stranger.deleteFeedback({ id: round.id, feedbackId: feedback.id }),
    ).rejects.toThrow();
    expect(storageDeleteByOwner).not.toHaveBeenCalled();
  });
});
