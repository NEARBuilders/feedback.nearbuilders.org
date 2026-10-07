import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

let counter = 0;

/** The same user, with several linked NEAR accounts and a chosen primary. */
function withLinkedAccounts(userId: string, primary: string, all: string[]) {
  const base = nearAuthedContext(primary, userId) as Record<string, unknown> & {
    near: Record<string, unknown>;
  };
  return {
    ...base,
    near: {
      ...base.near,
      primaryAccountId: primary,
      linkedAccounts: all.map((accountId) => ({
        accountId,
        network: "mainnet",
        publicKey: "ed25519:test",
        isPrimary: accountId === primary,
      })),
    },
  };
}

async function openRound() {
  const n = ++counter;
  const owner = await getPluginClient(nearAuthedContext(`linked-owner-${n}.near`));
  const round = await owner.createRound({
    projectSlug: `linked-project-${n}`,
    title: `Linked ${n}`,
    description: "Switch wallets freely.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { n, owner, round };
}

describe("linked NEAR accounts (#121)", () => {
  it("keeps a user's participation and history after they switch primary wallet", async () => {
    const { n, round } = await openRound();
    const oldWallet = `linked-old-${n}.near`;
    const newWallet = `linked-new-${n}.near`;
    const all = [newWallet, oldWallet];

    const before = await getPluginClient(withLinkedAccounts(`linked-user-${n}`, oldWallet, all));
    await before.joinRound({ id: round.id });
    const posted = await before.postFeedback({ id: round.id, format: "written", body: "From old" });
    expect(posted.authorAccountId).toBe(oldWallet);

    const after = await getPluginClient(withLinkedAccounts(`linked-user-${n}`, newWallet, all));
    expect(await after.getMyParticipation({ id: round.id })).toEqual({ joined: true });
    expect((await after.listMyJoinedRounds()).map((r) => r.roundId)).toEqual([round.id]);
    expect((await after.listMyJoinedRounds())[0]?.myFeedbackCount).toBe(1);
  });

  it("posts as the account that joined, not the new primary", async () => {
    const { n, round } = await openRound();
    const oldWallet = `linked-old2-${n}.near`;
    const newWallet = `linked-new2-${n}.near`;
    const all = [newWallet, oldWallet];

    await (
      await getPluginClient(withLinkedAccounts(`linked-user2-${n}`, oldWallet, all))
    ).joinRound({ id: round.id });

    const after = await getPluginClient(withLinkedAccounts(`linked-user2-${n}`, newWallet, all));
    const posted = await after.postFeedback({ id: round.id, format: "written", body: "Still me" });
    expect(posted.authorAccountId).toBe(oldWallet);
  });

  it("doesn't join twice with a second linked wallet, and leave removes the one participation", async () => {
    const { n, round } = await openRound();
    const a = `linked-a-${n}.near`;
    const b = `linked-b-${n}.near`;

    const asA = await getPluginClient(withLinkedAccounts(`linked-user3-${n}`, a, [a, b]));
    await asA.joinRound({ id: round.id });
    const asB = await getPluginClient(withLinkedAccounts(`linked-user3-${n}`, b, [a, b]));
    const detail = await asB.joinRound({ id: round.id });
    expect(detail.participantCount).toBe(1);

    const left = await asB.leaveRound({ id: round.id });
    expect(left.participantCount).toBe(0);
    expect(await asB.getMyParticipation({ id: round.id })).toEqual({ joined: false });
  });

  it("refuses to join your own round with any linked account", async () => {
    const { round } = await openRound();
    const extra = "linked-extra-wallet.near";
    const ownerWithExtra = await getPluginClient(
      withLinkedAccounts("linked-owner-user", extra, [extra, round.ownerAccountId]),
    );
    await expect(ownerWithExtra.joinRound({ id: round.id })).rejects.toThrow("your own round");
  });

  it("shows notifications addressed to any linked account", async () => {
    const { n, owner, round } = await openRound();
    const oldWallet = `linked-old4-${n}.near`;
    const newWallet = `linked-new4-${n}.near`;
    const all = [newWallet, oldWallet];

    const asOld = await getPluginClient(withLinkedAccounts(`linked-user4-${n}`, oldWallet, all));
    await asOld.joinRound({ id: round.id });
    await owner.broadcastToRound({ id: round.id, kind: "custom", message: "New build" });

    const asNew = await getPluginClient(withLinkedAccounts(`linked-user4-${n}`, newWallet, all));
    const inbox = await asNew.listNotifications({});
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.items.map((i) => i.body)).toContain("New build");
    expect(await asNew.markAllNotificationsRead()).toEqual({ updated: 1 });
  });

  it("still rejects people with no linked NEAR account", async () => {
    const { round } = await openRound();
    const anon = await getPluginClient();
    await expect(anon.joinRound({ id: round.id })).rejects.toThrow();
  });
});
