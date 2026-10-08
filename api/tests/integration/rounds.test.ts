import { describe, expect, it } from "vitest";
import {
  adminContext,
  authedContext,
  getPluginClient,
  nearAuthedContext,
  orgContext,
} from "../setup";

const baseInput = {
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

let slugCounter = 0;
/** Round input on a project slug no other test has used (slugs are unique across orgs). */
const fresh = () => ({ ...baseInput, projectSlug: `test-project-${++slugCounter}` });

interface RoundOverrides {
  title: string;
  projectSlug?: string;
  description?: string;
  formats?: Array<"written" | "recorded" | "issues">;
  repoUrl?: string;
}

/**
 * Requests a round and, if its project is still pending, approves the project as
 * an admin. Returns the now-open round.
 */
async function createOpenRound(owner: string, input: RoundOverrides) {
  const ownerClient = await getPluginClient(nearAuthedContext(owner));
  const round = await ownerClient.createRound({ ...fresh(), ...input });
  if (round.status === "open") return round;
  const admin = await getPluginClient(adminContext());
  await admin.approveProject({ id: round.projectRecordId });
  return ownerClient.getRound({ id: round.id });
}

describe("createRound", () => {
  it("rejects unauthenticated requests", async () => {
    const client = await getPluginClient();
    await expect(client.createRound(fresh())).rejects.toThrow("Authentication required");
  });

  it("rejects a signed-in user with no linked NEAR account", async () => {
    const client = await getPluginClient(orgContext());
    await expect(client.createRound(fresh())).rejects.toThrow(
      "Link a NEAR account before requesting a feedback round",
    );
  });

  it("rejects a signed-in user with no active organization", async () => {
    const client = await getPluginClient(authedContext());
    await expect(client.createRound(fresh())).rejects.toThrow("Active organization required");
  });

  it("creates a round pending by default, awaiting admin approval", async () => {
    const client = await getPluginClient(nearAuthedContext("owner.near"));
    const input = fresh();
    const round = await client.createRound(input);

    expect(round).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: input.projectSlug,
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
    await expect(client.createRound({ ...fresh(), formats: [] })).rejects.toThrow();
  });

  it("stores the picker's resolved project id on the project, not just the slug", async () => {
    const client = await getPluginClient(nearAuthedContext("picker-owner.near"));
    const round = await client.createRound({
      ...baseInput,
      projectSlug: "onboarding-flow",
      projectId: "proj_1",
    });

    const project = await client.getProjectBySlug({ slug: round.projectSlug });
    expect(project.nearbuildersProjectId).toBe("proj_1");
  });

  it("defaults to no resolved project for a free-text slug", async () => {
    const client = await getPluginClient(nearAuthedContext("freetext-owner.near"));
    const round = await client.createRound(fresh());

    const project = await client.getProjectBySlug({ slug: round.projectSlug });
    expect(project.nearbuildersProjectId).toBeNull();
  });

  it("rejects the issues format without a repo URL", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...fresh(), formats: ["issues"] })).rejects.toThrow();
  });

  it("accepts the issues format when a repo URL is provided", async () => {
    const client = await getPluginClient(nearAuthedContext());
    const round = await client.createRound({
      ...fresh(),
      formats: ["issues"],
      repoUrl: "https://github.com/near/feedback",
    });
    expect(round.repoUrl).toBe("https://github.com/near/feedback");
  });

  it("numbers rounds sequentially per project, independent of other projects", async () => {
    const client = await getPluginClient(nearAuthedContext("numbering-owner.near"));

    const first = await client.createRound({ ...fresh(), projectSlug: "numbered-project" });
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: first.projectRecordId });
    const second = await client.createRound({ ...fresh(), projectSlug: "numbered-project" });
    const third = await client.createRound({ ...fresh(), projectSlug: "numbered-project" });
    expect(first.projectRoundNumber).toBe(1);
    expect(second.projectRoundNumber).toBe(2);
    expect(third.projectRoundNumber).toBe(3);

    const otherProject = await client.createRound({
      ...fresh(),
      projectSlug: "other-numbered-project",
    });
    expect(otherProject.projectRoundNumber).toBe(1);
  });
});

describe("project anchor (#69)", () => {
  it("creates a pending project, owned by the requesting org, when a round is requested", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner1.near"));
    const input = { ...fresh(), projectName: "Onboarding Flow" };
    const round = await owner.createRound(input);

    expect(round.status).toBe("pending");
    const mine = await owner.listMyProjects();
    const project = mine.find((p) => p.id === round.projectRecordId);
    expect(project).toMatchObject({
      slug: input.projectSlug,
      name: "Onboarding Flow",
      ownerOrgId: "org-of-proj-owner1.near",
      status: "pending",
      rejectionReason: null,
    });
    expect(project?.rounds.map((r) => r.id)).toEqual([round.id]);
  });

  it("defaults the project name to the slug", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner2.near"));
    const input = fresh();
    const round = await owner.createRound(input);
    const project = (await owner.listMyProjects()).find((p) => p.id === round.projectRecordId);
    expect(project?.name).toBe(input.projectSlug);
  });

  it("rejects a non-admin approving or rejecting a project", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner3.near"));
    const round = await owner.createRound(fresh());

    await expect(owner.approveProject({ id: round.projectRecordId })).rejects.toThrow();
    await expect(
      owner.rejectProject({ id: round.projectRecordId, reason: "nope" }),
    ).rejects.toThrow();

    const anon = await getPluginClient();
    await expect(anon.approveProject({ id: round.projectRecordId })).rejects.toThrow(
      "Authentication required",
    );
  });

  it("approves a project in one action, opening its pending round and listing it publicly", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner4.near"));
    const round = await owner.createRound(fresh());

    const admin = await getPluginClient(adminContext());
    const approved = await admin.approveProject({ id: round.projectRecordId });
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toEqual(expect.any(String));
    expect(approved.rounds).toEqual([expect.objectContaining({ id: round.id, status: "open" })]);

    const anon = await getPluginClient();
    const openRounds = await anon.listRounds({ status: "open" });
    expect(openRounds.some((r) => r.id === round.id)).toBe(true);
  });

  it("rejects approving a project that isn't pending", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner5.near"));
    const round = await owner.createRound(fresh());
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
    await expect(admin.approveProject({ id: round.projectRecordId })).rejects.toThrow(
      "Only pending projects can be approved",
    );
  });

  it("rejects a project with a required reason, rejecting its pending round and hiding it", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner6.near"));
    const round = await owner.createRound(fresh());
    const admin = await getPluginClient(adminContext());

    await expect(
      admin.rejectProject({ id: round.projectRecordId, reason: "  " }),
    ).rejects.toThrow();

    const rejected = await admin.rejectProject({
      id: round.projectRecordId,
      reason: "Repo is private",
    });
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Repo is private");
    expect(rejected.rounds).toEqual([
      expect.objectContaining({ id: round.id, status: "rejected" }),
    ]);

    const ownerView = await owner.getRound({ id: round.id });
    expect(ownerView.status).toBe("rejected");
    expect(ownerView.rejectionReason).toBe("Repo is private");

    const anon = await getPluginClient();
    const listed = await anon.listRounds({});
    expect(listed.some((r) => r.id === round.id)).toBe(false);
    await expect(anon.getRound({ id: round.id })).rejects.toThrow();
  });

  it("lets the requesting org see rejection status and reason on its projects", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner7.near"));
    const round = await owner.createRound(fresh());
    const admin = await getPluginClient(adminContext());
    await admin.rejectProject({ id: round.projectRecordId, reason: "Out of scope" });

    const project = (await owner.listMyProjects()).find((p) => p.id === round.projectRecordId);
    expect(project).toMatchObject({ status: "rejected", rejectionReason: "Out of scope" });

    const otherOrg = await getPluginClient(nearAuthedContext("proj-someone-else.near"));
    expect((await otherOrg.listMyProjects()).some((p) => p.id === round.projectRecordId)).toBe(
      false,
    );
  });

  it("lists projects for admins only, filterable by status", async () => {
    const owner = await getPluginClient(nearAuthedContext("proj-owner8.near"));
    const round = await owner.createRound(fresh());

    await expect(owner.listProjects({})).rejects.toThrow();

    const admin = await getPluginClient(adminContext());
    const pending = await admin.listProjects({ status: "pending" });
    expect(pending.some((p) => p.id === round.projectRecordId)).toBe(true);
    const approved = await admin.listProjects({ status: "approved" });
    expect(approved.some((p) => p.id === round.projectRecordId)).toBe(false);
  });

  it("fails with NOT_FOUND deciding an unknown project", async () => {
    const admin = await getPluginClient(adminContext());
    const missing = "00000000-0000-0000-0000-000000000000";
    await expect(admin.approveProject({ id: missing })).rejects.toThrow();
    await expect(admin.rejectProject({ id: missing, reason: "x" })).rejects.toThrow();
  });
});

describe("rounds belong to approved projects (#70)", () => {
  it("opens a new round immediately on an approved project, with no pending state", async () => {
    const first = await createOpenRound("own-owner1.near", { title: "First" });
    const owner = await getPluginClient(nearAuthedContext("own-owner1.near"));

    const second = await owner.createRound({ ...fresh(), projectSlug: first.projectSlug });
    expect(second.status).toBe("open");
    expect(second.projectRecordId).toBe(first.projectRecordId);
  });

  it("lets another member of the owning org create rounds, under the same project", async () => {
    const first = await createOpenRound("own-owner2.near", { title: "First" });
    const teammate = await getPluginClient(
      nearAuthedContext("own-teammate2.near", "user-2", "org-of-own-owner2.near"),
    );

    const round = await teammate.createRound({ ...fresh(), projectSlug: first.projectSlug });
    expect(round.status).toBe("open");
    expect(round.ownerAccountId).toBe("own-teammate2.near");
  });

  it("blocks another org from creating rounds on a project it doesn't own", async () => {
    const first = await createOpenRound("own-owner3.near", { title: "First" });
    const stranger = await getPluginClient(nearAuthedContext("own-stranger3.near"));

    await expect(
      stranger.createRound({ ...fresh(), projectSlug: first.projectSlug }),
    ).rejects.toThrow("belongs to another organization");
  });

  it("blocks creating more rounds while the project is pending or after it's rejected", async () => {
    const owner = await getPluginClient(nearAuthedContext("own-owner4.near"));
    const first = await owner.createRound(fresh());
    await expect(owner.createRound({ ...fresh(), projectSlug: first.projectSlug })).rejects.toThrow(
      "awaiting admin approval",
    );

    const admin = await getPluginClient(adminContext());
    await admin.rejectProject({ id: first.projectRecordId, reason: "Not a fit" });
    await expect(owner.createRound({ ...fresh(), projectSlug: first.projectSlug })).rejects.toThrow(
      "Not a fit",
    );
  });

  it("keeps incrementing per-project round numbers across approved rounds", async () => {
    const first = await createOpenRound("own-owner5.near", { title: "One" });
    const owner = await getPluginClient(nearAuthedContext("own-owner5.near"));
    const second = await owner.createRound({ ...fresh(), projectSlug: first.projectSlug });
    const third = await owner.createRound({ ...fresh(), projectSlug: first.projectSlug });
    expect([first.projectRoundNumber, second.projectRoundNumber, third.projectRoundNumber]).toEqual(
      [1, 2, 3],
    );
  });

  it("only lets the owning org manage a round, even for the round's original creator in another org", async () => {
    const round = await createOpenRound("own-owner6.near", { title: "Managed" });

    const sameAccountOtherOrg = await getPluginClient(
      nearAuthedContext("own-owner6.near", "user-1", "some-other-org"),
    );
    await expect(sameAccountOtherOrg.closeRound({ id: round.id })).rejects.toThrow(
      "Only the round owner can close it",
    );
    await expect(sameAccountOtherOrg.updateRound({ id: round.id, readme: "x" })).rejects.toThrow(
      "Only the round owner",
    );
    await expect(sameAccountOtherOrg.deleteRound({ id: round.id })).rejects.toThrow(
      "Only the round owner can delete it",
    );

    const teammate = await getPluginClient(
      nearAuthedContext("own-teammate6.near", "user-2", "org-of-own-owner6.near"),
    );
    const closed = await teammate.closeRound({ id: round.id });
    expect(closed.status).toBe("closed");
  });

  it("reports canManage on getRound for the owning org only", async () => {
    const round = await createOpenRound("own-owner7.near", { title: "Flag" });

    const owner = await getPluginClient(nearAuthedContext("own-owner7.near"));
    expect((await owner.getRound({ id: round.id })).canManage).toBe(true);

    const stranger = await getPluginClient(nearAuthedContext("own-stranger7.near"));
    expect((await stranger.getRound({ id: round.id })).canManage).toBe(false);

    const anon = await getPluginClient();
    expect((await anon.getRound({ id: round.id })).canManage).toBe(false);
  });
});

describe("round readme (#71)", () => {
  it("defaults to an empty readme", async () => {
    const owner = await getPluginClient(nearAuthedContext("readme-owner1.near"));
    const round = await owner.createRound(fresh());
    expect(round.readme).toBe("");
  });

  it("stores a readme supplied at creation", async () => {
    const owner = await getPluginClient(nearAuthedContext("readme-owner2.near"));
    const round = await owner.createRound({
      ...fresh(),
      readme: "## Focus\n\nTry the signup flow.",
    });
    expect(round.readme).toBe("## Focus\n\nTry the signup flow.");

    const fetched = await owner.getRound({ id: round.id });
    expect(fetched.readme).toBe("## Focus\n\nTry the signup flow.");
  });

  it("lets the owner edit the readme afterwards, and testers read it", async () => {
    const round = await createOpenRound("readme-owner3.near", { title: "Editable" });
    const owner = await getPluginClient(nearAuthedContext("readme-owner3.near"));

    const updated = await owner.updateRound({ id: round.id, readme: "Updated **steps**" });
    expect(updated.readme).toBe("Updated **steps**");

    const anon = await getPluginClient();
    expect((await anon.getRound({ id: round.id })).readme).toBe("Updated **steps**");

    const cleared = await owner.updateRound({ id: round.id, readme: "" });
    expect(cleared.readme).toBe("");
  });

  it("only lets the owner edit the readme", async () => {
    const round = await createOpenRound("readme-owner4.near", { title: "Locked" });

    const stranger = await getPluginClient(nearAuthedContext("readme-stranger.near"));
    await expect(stranger.updateRound({ id: round.id, readme: "hijack" })).rejects.toThrow(
      "Only the round owner can change round settings",
    );

    const anon = await getPluginClient();
    await expect(anon.updateRound({ id: round.id, readme: "hijack" })).rejects.toThrow(
      "Authentication required",
    );

    const owner = await getPluginClient(nearAuthedContext("readme-owner4.near"));
    expect((await owner.getRound({ id: round.id })).readme).toBe("");
  });

  it("rejects an oversized readme and an unknown round", async () => {
    const owner = await getPluginClient(nearAuthedContext("readme-owner5.near"));
    await expect(owner.createRound({ ...fresh(), readme: "x".repeat(20001) })).rejects.toThrow();
    await expect(
      owner.updateRound({ id: "00000000-0000-0000-0000-000000000000", readme: "x" }),
    ).rejects.toThrow();
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
    const pending = await owner.createRound({ ...fresh(), title: "Still pending" });

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
    const round = await owner.createRound({ ...fresh(), title: "Awaiting review" });

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
    const { items: thread } = await anon.listFeedback({ id: round.id });
    expect(thread.map((e) => e.format)).toEqual(["recorded", "written"]);
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
      projectSlug: round.projectSlug,
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
      projectSlug: round.projectSlug,
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
    return client.createRound({ ...fresh(), title: `Round for ${owner}` });
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

  it("deletes a closed round that never got feedback", async () => {
    const round = await createOpenRound("del3.near", { title: "Round for del3.near" });
    const owner = await getPluginClient(nearAuthedContext("del3.near"));
    await owner.closeRound({ id: round.id });
    const deleted = await owner.deleteRound({ id: round.id });
    expect(deleted.id).toBe(round.id);
  });

  it("rejects deleting a round that has feedback", async () => {
    const round = await createOpenRound("del5.near", { title: "Round for del5.near" });
    const owner = await getPluginClient(nearAuthedContext("del5.near"));
    const builder = await getPluginClient(nearAuthedContext("del5-builder.near"));
    await builder.joinRound({ id: round.id });
    await builder.postFeedback({ id: round.id, format: "written", body: "Found a bug" });

    await expect(owner.deleteRound({ id: round.id })).rejects.toThrow(
      "Rounds with feedback can't be deleted",
    );
  });

  it("fails with NOT_FOUND deleting an unknown round", async () => {
    const owner = await getPluginClient(nearAuthedContext("del4.near"));
    await expect(
      owner.deleteRound({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });
});

describe("rejectRound and restoreRound", () => {
  it("lets an admin hide an open round from everyone but its managers", async () => {
    const round = await createOpenRound("mod1.near", { title: "Round for mod1.near" });
    const admin = await getPluginClient(adminContext());
    const owner = await getPluginClient(nearAuthedContext("mod1.near"));
    const anon = await getPluginClient();

    const hidden = await admin.rejectRound({ id: round.id, reason: "Spam round" });
    expect(hidden).toMatchObject({ status: "rejected", rejectionReason: "Spam round" });
    expect(hidden.rejectedAt).toEqual(expect.any(String));

    await expect(anon.getRound({ id: round.id })).rejects.toThrow();
    // The owner manages the round, so they can still see it and its reason.
    const seenByOwner = await owner.getRound({ id: round.id });
    expect(seenByOwner).toMatchObject({ status: "rejected", rejectionReason: "Spam round" });

    const publicRounds = await anon.listRounds({});
    expect(publicRounds.some((r) => r.id === round.id)).toBe(false);
  });

  it("restores a hidden open round back to open", async () => {
    const round = await createOpenRound("mod2.near", { title: "Round for mod2.near" });
    const admin = await getPluginClient(adminContext());
    await admin.rejectRound({ id: round.id, reason: "Looks off" });

    const restored = await admin.restoreRound({ id: round.id });
    expect(restored).toMatchObject({ status: "open", rejectedAt: null, rejectionReason: null });

    const anon = await getPluginClient();
    expect((await anon.getRound({ id: round.id })).status).toBe("open");
  });

  it("restores a hidden closed round to closed", async () => {
    const round = await createOpenRound("mod3.near", { title: "Round for mod3.near" });
    const owner = await getPluginClient(nearAuthedContext("mod3.near"));
    const admin = await getPluginClient(adminContext());
    await owner.closeRound({ id: round.id });
    await admin.rejectRound({ id: round.id, reason: "Reviewing credits" });

    const restored = await admin.restoreRound({ id: round.id });
    expect(restored).toMatchObject({ status: "closed" });
  });

  it("refuses to hide an already hidden round and to restore a visible one", async () => {
    const round = await createOpenRound("mod4.near", { title: "Round for mod4.near" });
    const admin = await getPluginClient(adminContext());

    await admin.rejectRound({ id: round.id, reason: "Once" });
    await expect(admin.rejectRound({ id: round.id, reason: "Twice" })).rejects.toThrow(
      "already hidden",
    );
    await admin.restoreRound({ id: round.id });
    await expect(admin.restoreRound({ id: round.id })).rejects.toThrow("isn't hidden");
  });

  it("refuses non-admins", async () => {
    const round = await createOpenRound("mod5.near", { title: "Round for mod5.near" });
    const stranger = await getPluginClient(nearAuthedContext("mod5-stranger.near"));
    await expect(stranger.rejectRound({ id: round.id, reason: "Nope" })).rejects.toThrow();
    await expect(stranger.restoreRound({ id: round.id })).rejects.toThrow();
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
    const { items: thread } = await anon.listFeedback({ id: round.id });
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
  it("searchProjects reports itself unavailable rather than erroring", async () => {
    const client = await getPluginClient();
    await expect(client.searchProjects({ query: "onboarding" })).resolves.toEqual({
      available: false,
      results: [],
    });
  });

  it("getProjectSearchStatus reports search as not configured", async () => {
    const client = await getPluginClient();
    await expect(client.getProjectSearchStatus()).resolves.toEqual({ enabled: false });
  });
});

describe("feedback status", () => {
  async function roundWithEntries(owner: string, builder: string) {
    const round = await createOpenRound(owner, { title: `Status ${owner}` });
    const ownerClient = await getPluginClient(nearAuthedContext(owner));
    const builderClient = await getPluginClient(nearAuthedContext(builder));
    await builderClient.joinRound({ id: round.id });
    const first = await builderClient.postFeedback({
      id: round.id,
      format: "written",
      body: "First",
    });
    const second = await builderClient.postFeedback({
      id: round.id,
      format: "written",
      body: "Second",
    });
    return { round, ownerClient, builderClient, first, second };
  }

  it("defaults new feedback to unresolved", async () => {
    const { first } = await roundWithEntries("fs1.near", "fsb1.near");
    expect(first.status).toBe("unresolved");
  });

  it("lets the round owner resolve and dismiss, persisting the status", async () => {
    const { round, ownerClient, first, second } = await roundWithEntries("fs2.near", "fsb2.near");

    const resolved = await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [first.id],
      status: "resolved",
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.status).toBe("resolved");

    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [second.id],
      status: "dismissed",
    });

    const anon = await getPluginClient();
    const { items: thread } = await anon.listFeedback({ id: round.id });
    expect(thread.find((f) => f.id === first.id)?.status).toBe("resolved");
    expect(thread.find((f) => f.id === second.id)?.status).toBe("dismissed");
  });

  it("applies a bulk status change to the whole selection", async () => {
    const { round, ownerClient, first, second } = await roundWithEntries("fs3.near", "fsb3.near");
    const updated = await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [first.id, second.id],
      status: "resolved",
    });
    expect(updated.map((f) => f.status)).toEqual(["resolved", "resolved"]);
  });

  it("can move feedback back to unresolved", async () => {
    const { round, ownerClient, first } = await roundWithEntries("fs4.near", "fsb4.near");
    await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [first.id],
      status: "resolved",
    });
    const [reopened] = await ownerClient.setFeedbackStatus({
      id: round.id,
      feedbackIds: [first.id],
      status: "unresolved",
    });
    expect(reopened?.status).toBe("unresolved");
  });

  it("rejects the feedback author and other non-owners", async () => {
    const { round, builderClient, first } = await roundWithEntries("fs5.near", "fsb5.near");
    await expect(
      builderClient.setFeedbackStatus({
        id: round.id,
        feedbackIds: [first.id],
        status: "resolved",
      }),
    ).rejects.toThrow("round owner");
    const stranger = await getPluginClient(nearAuthedContext("fs-stranger.near"));
    await expect(
      stranger.setFeedbackStatus({ id: round.id, feedbackIds: [first.id], status: "resolved" }),
    ).rejects.toThrow("round owner");
  });

  it("rejects unauthenticated callers", async () => {
    const { round, first } = await roundWithEntries("fs6.near", "fsb6.near");
    const anon = await getPluginClient();
    await expect(
      anon.setFeedbackStatus({ id: round.id, feedbackIds: [first.id], status: "resolved" }),
    ).rejects.toThrow("Authentication required");
  });

  it("lets an admin set status", async () => {
    const { round, first } = await roundWithEntries("fs7.near", "fsb7.near");
    const admin = await getPluginClient(adminContext());
    const [updated] = await admin.setFeedbackStatus({
      id: round.id,
      feedbackIds: [first.id],
      status: "dismissed",
    });
    expect(updated?.status).toBe("dismissed");
  });

  it("ignores feedback ids that belong to another round", async () => {
    const a = await roundWithEntries("fs8.near", "fsb8.near");
    const b = await roundWithEntries("fs9.near", "fsb9.near");
    const updated = await a.ownerClient.setFeedbackStatus({
      id: a.round.id,
      feedbackIds: [b.first.id],
      status: "resolved",
    });
    expect(updated).toEqual([]);
    const { items: thread } = await (await getPluginClient()).listFeedback({ id: b.round.id });
    expect(thread.find((f) => f.id === b.first.id)?.status).toBe("unresolved");
  });
});

describe("listMyJoinedRounds", () => {
  it("returns the readme, repo and how much feedback the caller has posted per round", async () => {
    const round = await createOpenRound("jr1.near", {
      title: "Joined rounds",
      formats: ["written", "issues"],
      repoUrl: "https://github.com/acme/app",
    });
    const owner = await getPluginClient(nearAuthedContext("jr1.near"));
    await owner.updateRound({ id: round.id, readme: "## Try signup" });

    const tester = await getPluginClient(nearAuthedContext("jrt1.near"));
    await tester.joinRound({ id: round.id });
    await tester.postFeedback({ id: round.id, format: "written", body: "First" });
    await tester.postFeedback({ id: round.id, format: "written", body: "Second" });

    const other = await getPluginClient(nearAuthedContext("jrt1-other.near"));
    await other.joinRound({ id: round.id });
    await other.postFeedback({ id: round.id, format: "written", body: "Not mine" });

    const joined = await tester.listMyJoinedRounds();
    expect(joined).toHaveLength(1);
    expect(joined[0]).toMatchObject({
      roundId: round.id,
      roundTitle: "Joined rounds",
      status: "open",
      readme: "## Try signup",
      repoUrl: "https://github.com/acme/app",
      participantCount: 2,
      myFeedbackCount: 2,
    });
  });

  it("reports zero feedback for a round the caller joined but never posted in", async () => {
    const round = await createOpenRound("jr2.near", { title: "No feedback yet" });
    const tester = await getPluginClient(nearAuthedContext("jrt2.near"));
    await tester.joinRound({ id: round.id });

    const joined = await tester.listMyJoinedRounds();
    expect(joined[0]?.myFeedbackCount).toBe(0);
    expect(joined[0]?.readme).toBe("");
    expect(joined[0]?.repoUrl).toBeNull();
  });

  it("only lists rounds the caller joined", async () => {
    const round = await createOpenRound("jr3.near", { title: "Not joined" });
    const stranger = await getPluginClient(nearAuthedContext("jr3-stranger.near"));
    await expect(stranger.listMyJoinedRounds()).resolves.toEqual([]);
    const owner = await getPluginClient(nearAuthedContext("jr3.near"));
    await expect(owner.listMyJoinedRounds()).resolves.toEqual([]);
    expect(round.id).toEqual(expect.any(String));
  });
});

describe("listParticipants", () => {
  it("returns participants with joined dates to the owner and to participants", async () => {
    const round = await createOpenRound("lp1.near", { title: "Participants" });
    const ownerClient = await getPluginClient(nearAuthedContext("lp1.near"));
    const builderClient = await getPluginClient(nearAuthedContext("lpb1.near"));
    await builderClient.joinRound({ id: round.id });

    const asOwner = await ownerClient.listParticipants({ id: round.id });
    expect(asOwner).toEqual([
      { accountId: "lpb1.near", joinedAt: expect.any(String), feedbackCount: 0 },
    ]);

    const asParticipant = await builderClient.listParticipants({ id: round.id });
    expect(asParticipant).toEqual(asOwner);
  });

  it("returns an empty list when nobody has joined", async () => {
    const round = await createOpenRound("lp2.near", { title: "Empty participants" });
    const ownerClient = await getPluginClient(nearAuthedContext("lp2.near"));
    await expect(ownerClient.listParticipants({ id: round.id })).resolves.toEqual([]);
  });

  it("hides the list from strangers and anonymous callers", async () => {
    const round = await createOpenRound("lp3.near", { title: "Hidden participants" });
    const stranger = await getPluginClient(nearAuthedContext("lp-stranger.near"));
    await expect(stranger.listParticipants({ id: round.id })).rejects.toThrow("participants");
    const anon = await getPluginClient();
    await expect(anon.listParticipants({ id: round.id })).rejects.toThrow(
      "Authentication required",
    );
  });
});
