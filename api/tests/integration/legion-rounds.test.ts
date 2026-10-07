import { beforeEach, describe, expect, it } from "vitest";
import { adminContext, getPluginClient, legionCheckAccess, nearAuthedContext } from "../setup";

let counter = 0;

async function legionRound(legionOnly = true) {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`legion-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `legion-project-${n}`,
    title: `Legion ${n}`,
    description: "Only Legion members.",
    formats: ["written"],
    legionOnly,
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { round, owner };
}

beforeEach(() => {
  legionCheckAccess.mockReset();
  legionCheckAccess.mockResolvedValue({ hasAccess: false });
});

describe("Legion-gated rounds (#103)", () => {
  it("creates gated rounds and lets managers toggle the gate", async () => {
    const { round, owner } = await legionRound();
    expect(round.legionOnly).toBe(true);
    expect((await owner.updateRoundSettings({ id: round.id, legionOnly: false })).legionOnly).toBe(
      false,
    );
  });

  it("rejects non-holders at join time with a clear message", async () => {
    const { round } = await legionRound();
    const tester = await getPluginClient(nearAuthedContext("legion-nonholder.near"));
    await expect(tester.joinRound({ id: round.id })).rejects.toThrow(
      "You need a Legion SBT to join this round",
    );
    expect(await tester.getMyParticipation({ id: round.id })).toEqual({ joined: false });
  });

  it("lets holders join and post", async () => {
    legionCheckAccess.mockResolvedValue({ hasAccess: true });
    const { round } = await legionRound();
    const tester = await getPluginClient(nearAuthedContext("legion-holder.near"));
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "Holder feedback" }),
    ).resolves.toMatchObject({ body: "Holder feedback" });
    expect(legionCheckAccess).toHaveBeenCalledWith({ nearAccountId: "legion-holder.near" });
  });

  it("rejects non-holders at post time, e.g. after losing the SBT", async () => {
    legionCheckAccess.mockResolvedValue({ hasAccess: true });
    const { round } = await legionRound();
    const tester = await getPluginClient(nearAuthedContext("legion-lapsed.near"));
    await tester.joinRound({ id: round.id });

    legionCheckAccess.mockResolvedValue({ hasAccess: false });
    await expect(
      tester.postFeedback({ id: round.id, format: "written", body: "Too late" }),
    ).rejects.toThrow("You need a Legion SBT to post in this round");
  });

  it("fails closed when the holder lookup errors", async () => {
    legionCheckAccess.mockRejectedValue(new Error("plugin unavailable"));
    const { round } = await legionRound();
    const tester = await getPluginClient(nearAuthedContext("legion-unlucky.near"));
    await expect(tester.joinRound({ id: round.id })).rejects.toThrow("Legion SBT");
  });

  it("doesn't consult the plugin for ungated rounds", async () => {
    const { round } = await legionRound(false);
    const tester = await getPluginClient(nearAuthedContext("legion-free.near"));
    await expect(tester.joinRound({ id: round.id })).resolves.toMatchObject({ id: round.id });
    expect(legionCheckAccess).not.toHaveBeenCalled();
  });

  it("works together with private rounds", async () => {
    legionCheckAccess.mockResolvedValue({ hasAccess: true });
    const owner = await getPluginClient(nearAuthedContext("legion-owner-priv.near"));
    const round = await owner.createRound({
      projectSlug: "legion-private-project",
      title: "Legion and private",
      description: "Both gates.",
      formats: ["written"],
      isPrivate: true,
      legionOnly: true,
    });
    expect(round).toMatchObject({ isPrivate: true, legionOnly: true });
  });
});
