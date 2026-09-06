import { describe, expect, it } from "vitest";
import { authedContext, getPluginClient, nearAuthedContext } from "../setup";

const baseInput = {
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

describe("createRound", () => {
  it("rejects unauthenticated requests", async () => {
    const client = await getPluginClient();
    await expect(client.createRound(baseInput)).rejects.toThrow("Authentication required");
  });

  it("rejects a signed-in user with no linked NEAR account", async () => {
    const client = await getPluginClient(authedContext());
    await expect(client.createRound(baseInput)).rejects.toThrow(
      "Link a NEAR account before requesting a feedback round",
    );
  });

  it("creates a round as open immediately, no approval step", async () => {
    const client = await getPluginClient(nearAuthedContext("owner.near"));
    const round = await client.createRound(baseInput);

    expect(round).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: "my-project",
      title: baseInput.title,
      description: baseInput.description,
      formats: ["written"],
      repoUrl: null,
      status: "open",
    });
    expect(round.id).toEqual(expect.any(String));
    expect(round.closedAt).toBeNull();
  });

  it("rejects a round with no formats selected", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...baseInput, formats: [] })).rejects.toThrow();
  });

  it("rejects the issues format without a repo URL", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...baseInput, formats: ["issues"] })).rejects.toThrow();
  });

  it("accepts the issues format when a repo URL is provided", async () => {
    const client = await getPluginClient(nearAuthedContext());
    const round = await client.createRound({
      ...baseInput,
      formats: ["issues"],
      repoUrl: "https://github.com/near/feedback",
    });
    expect(round.repoUrl).toBe("https://github.com/near/feedback");
  });
});

describe("listRounds", () => {
  it("is public and needs no authentication", async () => {
    const owner = await getPluginClient(nearAuthedContext("lister-owner.near"));
    await owner.createRound({ ...baseInput, title: "Public round" });

    const anon = await getPluginClient();
    const rounds = await anon.listRounds({});
    expect(rounds.some((r) => r.title === "Public round")).toBe(true);
  });

  it("filters by status", async () => {
    const owner = await getPluginClient(nearAuthedContext("filter-owner.near"));
    const created = await owner.createRound({ ...baseInput, title: "Filter round" });

    const open = await owner.listRounds({ status: "open" });
    expect(open.some((r) => r.id === created.id)).toBe(true);

    const closed = await owner.listRounds({ status: "closed" });
    expect(closed.some((r) => r.id === created.id)).toBe(false);
  });
});

describe("getRound", () => {
  it("returns a round that exists, with a participant count", async () => {
    const owner = await getPluginClient(nearAuthedContext("reader-owner.near"));
    const created = await owner.createRound(baseInput);

    const anon = await getPluginClient();
    const fetched = await anon.getRound({ id: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.participantCount).toBe(0);
  });

  it("fails with NOT_FOUND for an unknown id", async () => {
    const client = await getPluginClient();
    await expect(client.getRound({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});

describe("joinRound / leaveRound", () => {
  async function freshRound(owner = "join-owner.near") {
    const client = await getPluginClient(nearAuthedContext(owner));
    return client.createRound({ ...baseInput, title: `Round for ${owner}` });
  }

  it("rejects unauthenticated joins", async () => {
    const round = await freshRound("a.near");
    const anon = await getPluginClient();
    await expect(anon.joinRound({ id: round.id })).rejects.toThrow("Authentication required");
  });

  it("rejects a signed-in user with no linked NEAR account", async () => {
    const round = await freshRound("b.near");
    const client = await getPluginClient(authedContext());
    await expect(client.joinRound({ id: round.id })).rejects.toThrow("Link a NEAR account");
  });

  it("rejects the owner joining their own round", async () => {
    const round = await freshRound("owner-self.near");
    const client = await getPluginClient(nearAuthedContext("owner-self.near"));
    await expect(client.joinRound({ id: round.id })).rejects.toThrow("your own round");
  });

  it("joins, is idempotent, and reflects the count", async () => {
    const round = await freshRound("c.near");
    const builder = await getPluginClient(nearAuthedContext("builder-1.near"));

    const first = await builder.joinRound({ id: round.id });
    expect(first.participantCount).toBe(1);

    const again = await builder.joinRound({ id: round.id });
    expect(again.participantCount).toBe(1);

    const participation = await builder.getMyParticipation({ id: round.id });
    expect(participation.joined).toBe(true);
  });

  it("leaves and can rejoin while the round is open", async () => {
    const round = await freshRound("d.near");
    const builder = await getPluginClient(nearAuthedContext("builder-2.near"));

    await builder.joinRound({ id: round.id });
    const left = await builder.leaveRound({ id: round.id });
    expect(left.participantCount).toBe(0);
    expect((await builder.getMyParticipation({ id: round.id })).joined).toBe(false);

    const rejoined = await builder.joinRound({ id: round.id });
    expect(rejoined.participantCount).toBe(1);
  });

  it("fails with NOT_FOUND joining an unknown round", async () => {
    const builder = await getPluginClient(nearAuthedContext("builder-3.near"));
    await expect(
      builder.joinRound({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});
