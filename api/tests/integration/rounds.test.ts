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

describe("postFeedback / listFeedback", () => {
  async function roundWithFormats(formats: Array<"written" | "recorded">, owner = "fb-owner.near") {
    const client = await getPluginClient(nearAuthedContext(owner));
    return client.createRound({ ...baseInput, formats, title: `FB round ${formats.join("+")}` });
  }

  it("rejects a non-participant", async () => {
    const round = await roundWithFormats(["written"], "fb1.near");
    const stranger = await getPluginClient(nearAuthedContext("stranger.near"));
    await expect(
      stranger.postFeedback({ id: round.id, format: "written", body: "hi" }),
    ).rejects.toThrow("Join the round");
  });

  it("rejects a format the round didn't ask for", async () => {
    const round = await roundWithFormats(["written"], "fb2.near");
    const builder = await getPluginClient(nearAuthedContext("fb-builder-2.near"));
    await builder.joinRound({ id: round.id });
    await expect(
      builder.postFeedback({ id: round.id, format: "recorded", url: "https://x.com/rec" }),
    ).rejects.toThrow("isn't collecting recorded");
  });

  it("rejects written feedback with an empty body", async () => {
    const round = await roundWithFormats(["written"], "fb3.near");
    const builder = await getPluginClient(nearAuthedContext("fb-builder-3.near"));
    await builder.joinRound({ id: round.id });
    await expect(
      builder.postFeedback({ id: round.id, format: "written", body: "   " }),
    ).rejects.toThrow();
  });

  it("accepts written and recorded feedback from a participant and lists it in order", async () => {
    const round = await roundWithFormats(["written", "recorded"], "fb4.near");
    const builder = await getPluginClient(nearAuthedContext("fb-builder-4.near"));
    await builder.joinRound({ id: round.id });

    await builder.postFeedback({ id: round.id, format: "written", body: "First note" });
    await builder.postFeedback({
      id: round.id,
      format: "recorded",
      url: "https://example.com/session",
    });

    const anon = await getPluginClient();
    const thread = await anon.listFeedback({ id: round.id });
    expect(thread.map((e) => e.format)).toEqual(["written", "recorded"]);
    expect(thread.find((e) => e.format === "written")?.body).toBe("First note");
    expect(thread.find((e) => e.format === "recorded")?.url).toBe("https://example.com/session");
  });

  it("fails with NOT_FOUND listing feedback for an unknown round", async () => {
    const anon = await getPluginClient();
    await expect(
      anon.listFeedback({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});

describe("closeRound / credits", () => {
  async function roundWithFeedback(owner: string, builder: string) {
    const ownerClient = await getPluginClient(nearAuthedContext(owner));
    const round = await ownerClient.createRound({
      ...baseInput,
      formats: ["written", "recorded"],
      title: `Close round ${owner}`,
    });
    const builderClient = await getPluginClient(nearAuthedContext(builder));
    await builderClient.joinRound({ id: round.id });
    await builderClient.postFeedback({ id: round.id, format: "written", body: "Solid" });
    await builderClient.postFeedback({ id: round.id, format: "recorded", url: "https://x.com/r" });
    return { round, ownerClient, builderClient };
  }

  it("rejects a non-owner closing the round", async () => {
    const { round } = await roundWithFeedback("close1.near", "cb1.near");
    const stranger = await getPluginClient(nearAuthedContext("stranger2.near"));
    await expect(stranger.closeRound({ id: round.id })).rejects.toThrow("owner");
  });

  it("lists credit candidates for the owner only, with post counts", async () => {
    const { round, ownerClient, builderClient } = await roundWithFeedback(
      "close2.near",
      "cb2.near",
    );

    await expect(builderClient.getCreditCandidates({ id: round.id })).rejects.toThrow();

    const candidates = await ownerClient.getCreditCandidates({ id: round.id });
    expect(candidates).toEqual([{ accountId: "cb2.near", writtenCount: 1, recordedCount: 1 }]);
  });

  it("closes the round and records contributor credit", async () => {
    const { round, ownerClient } = await roundWithFeedback("close3.near", "cb3.near");

    const closed = await ownerClient.closeRound({
      id: round.id,
      credits: [
        { builderAccountId: "cb3.near", contributedMeaningfully: true, summary: "Great catches" },
      ],
    });
    expect(closed.status).toBe("closed");

    const anon = await getPluginClient();
    const credits = await anon.listRoundCredits({ id: round.id });
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      builderAccountId: "cb3.near",
      projectSlug: baseInput.projectSlug,
      contributedMeaningfully: true,
      summary: "Great catches",
      writtenCount: 1,
      recordedCount: 1,
    });
  });

  it("rejects crediting someone who did not post feedback", async () => {
    const { round, ownerClient } = await roundWithFeedback("close4.near", "cb4.near");
    await expect(
      ownerClient.closeRound({
        id: round.id,
        credits: [{ builderAccountId: "nobody.near", contributedMeaningfully: true }],
      }),
    ).rejects.toThrow();
  });

  it("rejects closing an already-closed round", async () => {
    const { round, ownerClient } = await roundWithFeedback("close5.near", "cb5.near");
    await ownerClient.closeRound({ id: round.id });
    await expect(ownerClient.closeRound({ id: round.id })).rejects.toThrow("already closed");
  });
});

describe("getBuilderRounds", () => {
  it("is public and returns the closed rounds a builder was credited on", async () => {
    const owner = await getPluginClient(nearAuthedContext("bp-owner.near"));
    const round = await owner.createRound({
      ...baseInput,
      title: "Profile round",
      formats: ["written", "issues"],
      repoUrl: "https://github.com/near/feedback",
    });
    const builder = await getPluginClient(nearAuthedContext("bp-builder.near"));
    await builder.joinRound({ id: round.id });
    await builder.postFeedback({ id: round.id, format: "written", body: "Found a bug" });

    const anonBefore = await getPluginClient();
    expect(await anonBefore.getBuilderRounds({ accountId: "bp-builder.near" })).toEqual([]);

    await owner.closeRound({
      id: round.id,
      credits: [
        { builderAccountId: "bp-builder.near", contributedMeaningfully: true, summary: "Sharp" },
      ],
    });

    const anon = await getPluginClient();
    const rounds = await anon.getBuilderRounds({ accountId: "bp-builder.near" });
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({
      roundId: round.id,
      roundTitle: "Profile round",
      projectSlug: baseInput.projectSlug,
      contributedMeaningfully: true,
      summary: "Sharp",
      writtenCount: 1,
      recordedCount: 0,
      repoUrl: "https://github.com/near/feedback",
      issuesUrl: "https://github.com/near/feedback/issues",
    });
  });

  it("returns an empty list for an unknown account", async () => {
    const anon = await getPluginClient();
    expect(await anon.getBuilderRounds({ accountId: "nobody.near" })).toEqual([]);
  });
});
