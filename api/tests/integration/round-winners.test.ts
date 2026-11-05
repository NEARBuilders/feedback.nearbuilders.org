import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`winners-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `winners-project-${n}`,
    title: `Winners ${n}`,
    description: "Owner marks winners.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { round, owner };
}

describe("round winners", () => {
  it("starts empty", async () => {
    const { round } = await openRound();
    expect(round.winners).toEqual([]);
  });

  it("lets the owner set a ranked list, deduped, and clear it", async () => {
    const { round, owner } = await openRound();
    const set = await owner.updateRoundSettings({
      id: round.id,
      winners: ["b.near", "a.tg", "b.near"],
    });
    expect(set.winners).toEqual(["b.near", "a.tg"]);

    const read = await owner.getRound({ id: round.id });
    expect(read.winners).toEqual(["b.near", "a.tg"]);

    const cleared = await owner.updateRoundSettings({ id: round.id, winners: [] });
    expect(cleared.winners).toEqual([]);
  });

  it("leaves winners alone when other settings change", async () => {
    const { round, owner } = await openRound();
    await owner.updateRoundSettings({ id: round.id, winners: ["a.near"] });
    const after = await owner.updateRoundSettings({ id: round.id, isPrivate: true });
    expect(after.winners).toEqual(["a.near"]);
  });

  it("rejects anyone who doesn't manage the round", async () => {
    const { round } = await openRound();
    const stranger = await getPluginClient(nearAuthedContext("winners-stranger.near"));
    await expect(
      stranger.updateRoundSettings({ id: round.id, winners: ["a.near"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("round winners validation", () => {
  it("lowercases ids and collapses case-variant duplicates", async () => {
    const { round, owner } = await openRound();
    const set = await owner.updateRoundSettings({
      id: round.id,
      winners: ["Alice.near", "alice.NEAR", "bob.tg"],
    });
    expect(set.winners).toEqual(["alice.near", "bob.tg"]);
  });

  it("rejects malformed ids and over-long lists", async () => {
    const { round, owner } = await openRound();
    for (const bad of ["alice..near", "a/b", "?x", "has space"]) {
      await expect(
        owner.updateRoundSettings({ id: round.id, winners: [bad] }),
      ).rejects.toBeDefined();
    }
    const many = Array.from({ length: 51 }, (_, i) => `w${i}.near`);
    await expect(owner.updateRoundSettings({ id: round.id, winners: many })).rejects.toBeDefined();
  });
});
