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
    await expect(tester.joinRound({ id: round.id })).rejects.toThrow("This round has expired");
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
    ).rejects.toThrow("This round has expired");
  });
});
