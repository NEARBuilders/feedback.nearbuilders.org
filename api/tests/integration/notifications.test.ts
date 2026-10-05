import { describe, expect, it } from "vitest";
import {
  adminContext,
  authedContext,
  getPluginClient,
  nearAuthedContext,
  orgContext,
} from "../setup";

let slugCounter = 0;

async function createOpenRound(owner: string, title: string) {
  const ownerClient = await getPluginClient(nearAuthedContext(owner));
  const round = await ownerClient.createRound({
    projectSlug: `notify-project-${++slugCounter}`,
    title,
    description: "Walk through signup and tell us where you got stuck.",
    formats: ["written"],
  });
  if (round.status === "open") return round;
  const admin = await getPluginClient(adminContext());
  await admin.approveProject({ id: round.projectRecordId });
  return ownerClient.getRound({ id: round.id });
}

async function roundWithTesters(owner: string, testers: string[], title = "Notify round") {
  const round = await createOpenRound(owner, title);
  for (const tester of testers) {
    const client = await getPluginClient(nearAuthedContext(tester));
    await client.joinRound({ id: round.id });
  }
  const ownerClient = await getPluginClient(nearAuthedContext(owner));
  return { round, ownerClient };
}

describe("broadcastToRound", () => {
  it("delivers a custom message to every participant and reports the recipient count", async () => {
    const { round, ownerClient } = await roundWithTesters("bc1.near", ["bct1a.near", "bct1b.near"]);

    const result = await ownerClient.broadcastToRound({
      id: round.id,
      kind: "custom",
      message: "New build is live",
    });
    expect(result).toEqual({ recipients: 2 });

    for (const tester of ["bct1a.near", "bct1b.near"]) {
      const client = await getPluginClient(nearAuthedContext(tester));
      const { items, unreadCount } = await client.listNotifications({});
      expect(unreadCount).toBe(1);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        roundId: round.id,
        roundTitle: "Notify round",
        kind: "custom",
        title: "Update on Notify round",
        body: "New build is live",
        readAt: null,
      });
    }
  });

  it("sends the opened and closing presets with their default text", async () => {
    const { round, ownerClient } = await roundWithTesters("bc2.near", ["bct2.near"]);
    await ownerClient.broadcastToRound({ id: round.id, kind: "round_opened" });
    await ownerClient.broadcastToRound({
      id: round.id,
      kind: "round_closing",
      message: "Closes Friday",
    });

    const tester = await getPluginClient(nearAuthedContext("bct2.near"));
    const { items } = await tester.listNotifications({});
    expect(items.map((item) => item.kind).sort()).toEqual(["round_closing", "round_opened"]);
    expect(items.find((item) => item.kind === "round_closing")?.body).toBe("Closes Friday");
    expect(items.find((item) => item.kind === "round_opened")?.body).toContain("round is open");
  });

  it("never shows a round's notifications to a non-participant", async () => {
    const { round, ownerClient } = await roundWithTesters("bc3.near", ["bct3.near"]);
    await ownerClient.broadcastToRound({ id: round.id, kind: "custom", message: "Private note" });

    const stranger = await getPluginClient(nearAuthedContext("bc3-stranger.near"));
    await expect(stranger.listNotifications({})).resolves.toEqual({ items: [], unreadCount: 0 });

    const owner = await getPluginClient(nearAuthedContext("bc3.near"));
    await expect(owner.listNotifications({})).resolves.toEqual({ items: [], unreadCount: 0 });
  });

  it("keeps notifications from different rounds separate per participant", async () => {
    const a = await roundWithTesters("bc4a.near", ["bct4.near"], "Round A");
    const b = await roundWithTesters("bc4b.near", [], "Round B");
    await a.ownerClient.broadcastToRound({ id: a.round.id, kind: "custom", message: "A only" });
    await b.ownerClient.broadcastToRound({ id: b.round.id, kind: "custom", message: "B only" });

    const tester = await getPluginClient(nearAuthedContext("bct4.near"));
    const { items } = await tester.listNotifications({});
    expect(items.map((item) => item.body)).toEqual(["A only"]);
  });

  it("rejects people who are not the round owner", async () => {
    const { round } = await roundWithTesters("bc5.near", ["bct5.near"]);
    const tester = await getPluginClient(nearAuthedContext("bct5.near"));
    await expect(
      tester.broadcastToRound({ id: round.id, kind: "custom", message: "hi" }),
    ).rejects.toThrow("round owner");
    const stranger = await getPluginClient(nearAuthedContext("bc5-stranger.near"));
    await expect(
      stranger.broadcastToRound({ id: round.id, kind: "custom", message: "hi" }),
    ).rejects.toThrow("round owner");
  });

  it("rejects signed-out callers", async () => {
    const { round } = await roundWithTesters("bc6.near", []);
    const anon = await getPluginClient();
    await expect(anon.broadcastToRound({ id: round.id, kind: "round_opened" })).rejects.toThrow(
      "Authentication required",
    );
  });

  it("lets an admin broadcast", async () => {
    const { round } = await roundWithTesters("bc7.near", ["bct7.near"]);
    const admin = await getPluginClient(adminContext());
    await expect(admin.broadcastToRound({ id: round.id, kind: "round_opened" })).resolves.toEqual({
      recipients: 1,
    });
  });

  it("requires a message for a custom broadcast", async () => {
    const { round, ownerClient } = await roundWithTesters("bc8.near", ["bct8.near"]);
    await expect(ownerClient.broadcastToRound({ id: round.id, kind: "custom" })).rejects.toThrow();
    await expect(
      ownerClient.broadcastToRound({ id: round.id, kind: "custom", message: "   " }),
    ).rejects.toThrow();
  });

  it("only sends while the round is open", async () => {
    const { round, ownerClient } = await roundWithTesters("bc9.near", ["bct9.near"]);
    await ownerClient.closeRound({ id: round.id });
    await expect(
      ownerClient.broadcastToRound({ id: round.id, kind: "custom", message: "late" }),
    ).rejects.toThrow("open");
  });

  it("reports zero recipients for a round nobody has joined", async () => {
    const { round, ownerClient } = await roundWithTesters("bc10.near", []);
    await expect(
      ownerClient.broadcastToRound({ id: round.id, kind: "round_opened" }),
    ).resolves.toEqual({ recipients: 0 });
  });
});

describe("round lifecycle notifications", () => {
  it("notifies participants when the owner closes the round", async () => {
    const { round, ownerClient } = await roundWithTesters("lc1.near", ["lct1.near"], "Closing");
    await ownerClient.closeRound({ id: round.id });

    const tester = await getPluginClient(nearAuthedContext("lct1.near"));
    const { items, unreadCount } = await tester.listNotifications({});
    expect(unreadCount).toBe(1);
    expect(items[0]).toMatchObject({ kind: "round_closed", title: "Round closed: Closing" });
  });
});

describe("reading notifications", () => {
  async function testerWithTwo(owner: string, tester: string) {
    const { round, ownerClient } = await roundWithTesters(owner, [tester]);
    await ownerClient.broadcastToRound({ id: round.id, kind: "custom", message: "one" });
    await ownerClient.broadcastToRound({ id: round.id, kind: "custom", message: "two" });
    const client = await getPluginClient(nearAuthedContext(tester));
    const { items } = await client.listNotifications({});
    return { client, items };
  }

  it("returns newest first", async () => {
    const { items } = await testerWithTwo("rd1.near", "rdt1.near");
    expect(items.map((item) => item.body)).toEqual(["two", "one"]);
  });

  it("marks a single notification read and persists it", async () => {
    const { client, items } = await testerWithTwo("rd2.near", "rdt2.near");
    const first = items[0];
    if (!first) throw new Error("expected a notification");

    const read = await client.markNotificationRead({ id: first.id });
    expect(read.readAt).toEqual(expect.any(String));

    const after = await client.listNotifications({});
    expect(after.unreadCount).toBe(1);
    expect(after.items.find((item) => item.id === first.id)?.readAt).toEqual(expect.any(String));
  });

  it("keeps the original read time when marked read again", async () => {
    const { client, items } = await testerWithTwo("rd3.near", "rdt3.near");
    const first = items[0];
    if (!first) throw new Error("expected a notification");
    const once = await client.markNotificationRead({ id: first.id });
    const twice = await client.markNotificationRead({ id: first.id });
    expect(twice.readAt).toBe(once.readAt);
  });

  it("marks everything read", async () => {
    const { client } = await testerWithTwo("rd4.near", "rdt4.near");
    await expect(client.markAllNotificationsRead()).resolves.toEqual({ updated: 2 });
    await expect(client.markAllNotificationsRead()).resolves.toEqual({ updated: 0 });
    const after = await client.listNotifications({});
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((item) => item.readAt !== null)).toBe(true);
  });

  it("cannot mark someone else's notification read", async () => {
    const { items } = await testerWithTwo("rd5.near", "rdt5.near");
    const first = items[0];
    if (!first) throw new Error("expected a notification");
    const stranger = await getPluginClient(nearAuthedContext("rd5-stranger.near"));
    await expect(stranger.markNotificationRead({ id: first.id })).rejects.toThrow();

    const tester = await getPluginClient(nearAuthedContext("rdt5.near"));
    const after = await tester.listNotifications({});
    expect(after.unreadCount).toBe(2);
  });

  it("respects the limit while still counting every unread notification", async () => {
    const { client } = await testerWithTwo("rd6.near", "rdt6.near");
    const limited = await client.listNotifications({ limit: 1 });
    expect(limited.items).toHaveLength(1);
    expect(limited.unreadCount).toBe(2);
  });

  it("returns an empty list for a signed-in user with no linked NEAR account", async () => {
    const client = await getPluginClient(orgContext());
    await expect(client.listNotifications({})).resolves.toEqual({ items: [], unreadCount: 0 });
    await expect(client.markAllNotificationsRead()).resolves.toEqual({ updated: 0 });
  });

  it("rejects signed-out callers", async () => {
    const anon = await getPluginClient();
    await expect(anon.listNotifications({})).rejects.toThrow("Authentication required");
    await expect(anon.markAllNotificationsRead()).rejects.toThrow("Authentication required");
  });

  it("requires a linked NEAR account to mark a single notification", async () => {
    const client = await getPluginClient(authedContext());
    await expect(
      client.markNotificationRead({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow("NEAR");
  });
});
