import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

async function openRound() {
  const owner = await getPluginClient(nearAuthedContext("fail-owner.near"));
  const round = await owner.createRound({
    isPrivate: false,
    projectSlug: "fail-project",
    title: "Failures",
    description: "Delivery check.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { owner, round };
}

describe("a round's undelivered activity (#326)", () => {
  it("shows the owner an empty list when nothing is stuck", async () => {
    const { owner, round } = await openRound();
    expect(await owner.listRoundFailedActivity({ id: round.id })).toEqual([]);
  });

  it("keeps other people out, signed in or not", async () => {
    const { round } = await openRound();
    const stranger = await getPluginClient(nearAuthedContext("fail-stranger.near"));
    await expect(stranger.listRoundFailedActivity({ id: round.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      stranger.retryRoundFailedActivity({ id: round.id, ids: [crypto.randomUUID()] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const anon = await getPluginClient();
    await expect(anon.listRoundFailedActivity({ id: round.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("retries nothing for ids that are not this round's", async () => {
    const { owner, round } = await openRound();
    expect(
      await owner.retryRoundFailedActivity({ id: round.id, ids: [crypto.randomUUID()] }),
    ).toEqual({ retried: 0 });
  });
});
