import { describe, expect, it } from "vitest";
import { adminContext, authedContext, getPluginClient, nearAuthedContext } from "../setup";

const baseInput = {
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

interface RoundOverrides {
  title: string;
  projectSlug?: string;
  description?: string;
  formats?: Array<"written" | "recorded" | "issues">;
  repoUrl?: string;
}

/** Creates a round and immediately approves it as an admin, returning the now-open round. */
async function createOpenRound(owner: string, input: RoundOverrides) {
  const ownerClient = await getPluginClient(nearAuthedContext(owner));
  const round = await ownerClient.createRound({ ...baseInput, ...input });
  const admin = await getPluginClient(adminContext());
  return admin.approveRound({ id: round.id });
}

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

  it("creates a round pending by default, awaiting admin approval", async () => {
    const client = await getPluginClient(nearAuthedContext("owner.near"));
    const round = await client.createRound(baseInput);

    expect(round).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: "my-project",
      title: baseInput.title,
      description: baseInput.description,
      formats: ["written"],
      repoUrl: null,
      status: "pending",
    });
    expect(round.id).toEqual(expect.any(String));
    expect(round.closedAt).toBeNull();
    expect(round.rejectedAt).toBeNull();
  });

  it("rejects a round with no formats selected", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...baseInput, formats: [] })).rejects.toThrow();
  });

  it("stores a resolved projectId alongside the slug when the picker supplied one", async () => {
    const client = await getPluginClient(nearAuthedContext("picker-owner.near"));
    const round = await client.createRound({
      ...baseInput,
      projectSlug: "onboarding-flow",
      projectId: "proj_1",
    });

    expect(round.projectId).toBe("proj_1");
  });

  it("defaults projectId to null for a free-text slug with no resolved project", async () => {
    const client = await getPluginClient(nearAuthedContext("freetext-owner.near"));
    const round = await client.createRound(baseInput);

    expect(round.projectId).toBeNull();
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

  it("numbers rounds sequentially per project, independent of other projects", async () => {
    const client = await getPluginClient(nearAuthedContext("numbering-owner.near"));

    const first = await client.createRound({ ...baseInput, projectSlug: "numbered-project" });
    const second = await client.createRound({ ...baseInput, projectSlug: "numbered-project" });
    expect(first.projectRoundNumber).toBe(1);
    expect(second.projectRoundNumber).toBe(2);

    const otherProject = await client.createRound({
      ...baseInput,
      projectSlug: "other-numbered-project",
    });
    expect(otherProject.projectRoundNumber).toBe(1);
  });
});

describe("approveRound / rejectRound / listPendingRounds", () => {
  it("rejects a non-admin approving a round", async () => {
    const owner = await getPluginClient(nearAuthedContext("appr-owner1.near"));
    const round = await owner.createRound({ ...baseInput, title: "Needs admin" });

    await expect(owner.approveRound({ id: round.id })).rejects.toThrow();

    const anon = await getPluginClient();
    await expect(anon.approveRound({ id: round.id })).rejects.toThrow("Authentication required");
  });

  it("approves a pending round, making it open and publicly listed", async () => {
    const owner = await getPluginClient(nearAuthedContext("appr-owner2.near"));
    const round = await owner.createRound({ ...baseInput, title: "Approve me" });

    const admin = await getPluginClient(adminContext());
    const approved = await admin.approveRound({ id: round.id });
    expect(approved.status).toBe("open");

    const anon = await getPluginClient();
    const openRounds = await anon.listRounds({ status: "open" });
    expect(openRounds.some((r) => r.id === round.id)).toBe(true);
  });

  it("rejects approving a round that isn't pending", async () => {
    const owner = await getPluginClient(nearAuthedContext("appr-owner3.near"));
    const round = await owner.createRound({ ...baseInput, title: "Double approve" });
    const admin = await getPluginClient(adminContext());
    await admin.approveRound({ id: round.id });
    await expect(admin.approveRound({ id: round.id })).rejects.toThrow(
      "Only pending rounds can be approved",
    );
  });

  it("rejects a pending round with a reason, keeping it out of public listings", async () => {
    const owner = await getPluginClient(nearAuthedContext("rej-owner1.near"));
    const round = await owner.createRound({ ...baseInput, title: "Reject me" });

    const admin = await getPluginClient(adminContext());
    const rejected = await admin.rejectRound({ id: round.id, reason: "Repo is private" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Repo is private");

    const anon = await getPluginClient();
    const openRounds = await anon.listRounds({});
    expect(openRounds.some((r) => r.id === round.id)).toBe(false);
    await expect(anon.getRound({ id: round.id })).rejects.toThrow();
  });

  it("lists only pending rounds for an admin, and rejects non-admins", async () => {
    const owner = await getPluginClient(nearAuthedContext("pend-owner1.near"));
    const round = await owner.createRound({ ...baseInput, title: "In the queue" });

    await expect(owner.listPendingRounds()).rejects.toThrow();

    const admin = await getPluginClient(adminContext());
    const pending = await admin.listPendingRounds();
    expect(pending.some((r) => r.id === round.id)).toBe(true);
  });
});

describe("listRounds", () => {
  it("is public and needs no authentication", async () => {
    const round = await createOpenRound("lister-owner.near", { title: "Public round" });

    const anon = await getPluginClient();
    const rounds = await anon.listRounds({});
    expect(rounds.some((r) => r.id === round.id)).toBe(true);
  });

  it("includes each round's participant count", async () => {
    const round = await createOpenRound("count-owner.near", { title: "Counted round" });

    const anon = await getPluginClient();
    const listed = (await anon.listRounds({})).find((r) => r.id === round.id);
    expect(listed?.participantCount).toBe(0);
  });

  it("excludes pending and rejected rounds from the unfiltered public listing", async () => {
    const owner = await getPluginClient(nearAuthedContext("hidden-owner.near"));
    const pending = await owner.createRound({ ...baseInput, title: "Still pending" });

    const anon = await getPluginClient();
    const rounds = await anon.listRounds({});
    expect(rounds.some((r) => r.id === pending.id)).toBe(false);
  });

  it("filters by status", async () => {
    const created = await createOpenRound("filter-owner.near", { title: "Filter round" });

    const owner = await getPluginClient(nearAuthedContext("filter-owner.near"));
    const open = await owner.listRounds({ status: "open" });
    expect(open.some((r) => r.id === created.id)).toBe(true);

    const closed = await owner.listRounds({ status: "closed" });
    expect(closed.some((r) => r.id === created.id)).toBe(false);
  });

  it("rejects a non-admin filtering by pending or rejected", async () => {
    const owner = await getPluginClient(nearAuthedContext("filter-owner2.near"));
    await expect(owner.listRounds({ status: "pending" })).rejects.toThrow();
    await expect(owner.listRounds({ status: "rejected" })).rejects.toThrow();
  });
});

describe("getRound", () => {
  it("returns an open round that exists, with a participant count", async () => {
    const created = await createOpenRound("reader-owner.near", { title: "Readable round" });

    const anon = await getPluginClient();
    const fetched = await anon.getRound({ id: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.participantCount).toBe(0);
  });

  it("fails with NOT_FOUND for an unknown id", async () => {
    const client = await getPluginClient();
    await expect(client.getRound({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });

  it("hides a pending round from strangers but shows it to its owner and admins", async () => {
    const owner = await getPluginClient(nearAuthedContext("reader-owner2.near"));
    const round = await owner.createRound({ ...baseInput, title: "Awaiting review" });

    const anon = await getPluginClient();
    await expect(anon.getRound({ id: round.id })).rejects.toThrow();

    const fetchedByOwner = await owner.getRound({ id: round.id });
    expect(fetchedByOwner.id).toBe(round.id);

    const admin = await getPluginClient(adminContext());
    const fetchedByAdmin = await admin.getRound({ id: round.id });
    expect(fetchedByAdmin.id).toBe(round.id);
  });
});

describe("joinRound / leaveRound", () => {
  async function freshRound(owner = "join-owner.near") {
    return createOpenRound(owner, { title: `Round for ${owner}` });
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
    return createOpenRound(owner, { formats, title: `FB round ${formats.join("+")}` });
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
    const round = await createOpenRound(owner, {
      formats: ["written", "recorded"],
      title: `Close round ${owner}`,
    });
    const ownerClient = await getPluginClient(nearAuthedContext(owner));
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
    const round = await createOpenRound("bp-owner.near", {
      title: "Profile round",
      formats: ["written", "issues"],
      repoUrl: "https://github.com/near/feedback",
    });
    const owner = await getPluginClient(nearAuthedContext("bp-owner.near"));
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

describe("deleteRound", () => {
  async function freshRound(owner = "del-owner.near") {
    const client = await getPluginClient(nearAuthedContext(owner));
    return client.createRound({ ...baseInput, title: `Round for ${owner}` });
  }

  it("rejects a non-owner deleting the round", async () => {
    const round = await freshRound("del1.near");
    const stranger = await getPluginClient(nearAuthedContext("del-stranger1.near"));
    await expect(stranger.deleteRound({ id: round.id })).rejects.toThrow("owner");
  });

  it("deletes a pending round so it no longer resolves", async () => {
    const round = await freshRound("del2.near");
    const owner = await getPluginClient(nearAuthedContext("del2.near"));
    const deleted = await owner.deleteRound({ id: round.id });
    expect(deleted.id).toBe(round.id);

    await expect(owner.getRound({ id: round.id })).rejects.toThrow();
  });

  it("deletes an open round so it no longer resolves", async () => {
    const round = await createOpenRound("del2b.near", { title: "Round for del2b.near" });
    const owner = await getPluginClient(nearAuthedContext("del2b.near"));
    const deleted = await owner.deleteRound({ id: round.id });
    expect(deleted.id).toBe(round.id);

    const anon = await getPluginClient();
    await expect(anon.getRound({ id: round.id })).rejects.toThrow();
  });

  it("rejects deleting an already-closed round", async () => {
    const round = await createOpenRound("del3.near", { title: "Round for del3.near" });
    const owner = await getPluginClient(nearAuthedContext("del3.near"));
    await owner.closeRound({ id: round.id });
    await expect(owner.deleteRound({ id: round.id })).rejects.toThrow("can't be deleted");
  });

  it("fails with NOT_FOUND deleting an unknown round", async () => {
    const owner = await getPluginClient(nearAuthedContext("del4.near"));
    await expect(
      owner.deleteRound({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});

describe("deleteFeedback", () => {
  async function roundWithFeedback(owner: string, builder: string) {
    const round = await createOpenRound(owner, { title: `Moderated round ${owner}` });
    const ownerClient = await getPluginClient(nearAuthedContext(owner));
    const builderClient = await getPluginClient(nearAuthedContext(builder));
    await builderClient.joinRound({ id: round.id });
    const feedback = await builderClient.postFeedback({
      id: round.id,
      format: "written",
      body: "Spam link",
    });
    return { round, ownerClient, feedback };
  }

  it("rejects a non-owner removing feedback", async () => {
    const { round, feedback } = await roundWithFeedback("mod1.near", "mod-b1.near");
    const stranger = await getPluginClient(nearAuthedContext("mod-stranger1.near"));
    await expect(
      stranger.deleteFeedback({ id: round.id, feedbackId: feedback.id }),
    ).rejects.toThrow("owner");
  });

  it("removes feedback so it no longer appears in the thread", async () => {
    const { round, ownerClient, feedback } = await roundWithFeedback("mod2.near", "mod-b2.near");
    const removed = await ownerClient.deleteFeedback({ id: round.id, feedbackId: feedback.id });
    expect(removed.id).toBe(feedback.id);

    const anon = await getPluginClient();
    const thread = await anon.listFeedback({ id: round.id });
    expect(thread.find((f) => f.id === feedback.id)).toBeUndefined();
  });

  it("fails with NOT_FOUND removing feedback that doesn't exist", async () => {
    const { round, ownerClient } = await roundWithFeedback("mod3.near", "mod-b3.near");
    await expect(
      ownerClient.deleteFeedback({
        id: round.id,
        feedbackId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow();
  });
});

describe("project picker (PROJECTS_API_BASE_URL unset in tests)", () => {
  it("searchProjects degrades to an empty list rather than erroring", async () => {
    const client = await getPluginClient();
    await expect(client.searchProjects({ query: "onboarding" })).resolves.toEqual([]);
  });

  it("resolveProjectBySlug degrades to null rather than erroring", async () => {
    const client = await getPluginClient();
    await expect(client.resolveProjectBySlug({ slug: "onboarding-flow" })).resolves.toBeNull();
  });
});
