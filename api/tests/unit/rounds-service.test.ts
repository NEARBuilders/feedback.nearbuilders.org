import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginIdTag } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseLive } from "@/db/layer";
import {
  ProjectRecordsLive,
  type ProjectRecordsService,
  ProjectRecordsTag,
} from "@/services/project-records";
import { RoundsLive, type RoundsService, RoundsTag } from "@/services/rounds";

let activeDir: string | null = null;

afterEach(() => {
  if (activeDir) {
    rmSync(activeDir, { recursive: true, force: true });
    activeDir = null;
  }
});

function freshLayer() {
  const dir = mkdtempSync(join(tmpdir(), "api-rounds-"));
  activeDir = dir;
  return Layer.mergeAll(RoundsLive, ProjectRecordsLive).pipe(
    Layer.provide(DatabaseLive(`pglite:${dir}`)),
    Layer.provide(Layer.succeed(PluginIdTag, "api")),
  );
}

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

type Services = RoundsService | ProjectRecordsService;

async function runService<A>(
  layer: Layer.Layer<Services, unknown, never>,
  fn: (svc: RoundsService, projects: ProjectRecordsService) => Promise<A>,
): Promise<A> {
  const effect = Effect.gen(function* () {
    const svc = yield* RoundsTag;
    const projects = yield* ProjectRecordsTag;
    return yield* Effect.tryPromise({ try: () => fn(svc, projects), catch: (error) => error });
  });
  return Effect.runPromise(Effect.provide(effect, layer));
}

/** Admin-approves the (pending) project a freshly created round hangs off. */
function approveProjectOf(
  layer: Layer.Layer<Services, unknown, never>,
  round: { projectRecordId: string },
) {
  return runService(layer, (_svc, projects) => projects.approveProject(round.projectRecordId));
}

const baseInput = {
  ownerAccountId: "owner.near",
  ownerOrgId: "org-1",
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

describe("RoundsService", () => {
  it("creates a round pending by default and resolves it by id", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) => svc.createRound(baseInput));

    expect(created).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: "my-project",
      formats: ["written"],
      repoUrl: null,
      status: "pending",
    });
    expect(created.id).toEqual(expect.any(String));
    expect(created.closedAt).toBeNull();
    expect(created.rejectedAt).toBeNull();
    expect(created.rejectionReason).toBeNull();

    const resolved = await runService(layer, (svc) => svc.resolveRoundById(created.id));
    expect(resolved?.id).toBe(created.id);
  });

  it("creates the project pending, owned by the requesting org, and links the round to it", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, projectName: "My Project" }),
    );

    const project = await runService(layer, (_svc, projects) =>
      projects.resolveProjectById(round.projectRecordId),
    );
    expect(project).toMatchObject({
      slug: "my-project",
      name: "My Project",
      ownerOrgId: "org-1",
      status: "pending",
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    });
    const bySlug = await runService(layer, (_svc, projects) =>
      projects.resolveProjectBySlug("my-project"),
    );
    expect(bySlug?.id).toBe(project?.id);
  });

  it("approves a pending project, opening its pending round, and can't approve twice", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) => svc.createRound(baseInput));

    const result = await approveProjectOf(layer, created);
    expect(result.project.status).toBe("approved");
    expect(result.project.approvedAt).toEqual(expect.any(String));
    expect(result.decidedRoundIds).toEqual([created.id]);

    const reloaded = await runService(layer, (svc) => svc.resolveRoundById(created.id));
    expect(reloaded?.status).toBe("open");

    await expect(approveProjectOf(layer, created)).rejects.toThrow(
      "Only pending projects can be approved",
    );
  });

  it("rejects a pending project with a reason, rejecting its pending round with it", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) => svc.createRound(baseInput));

    const result = await runService(layer, (_svc, projects) =>
      projects.rejectProject(created.projectRecordId, "Needs a clearer repo link"),
    );
    expect(result.project.status).toBe("rejected");
    expect(result.project.rejectedAt).toEqual(expect.any(String));
    expect(result.project.rejectionReason).toBe("Needs a clearer repo link");

    const reloaded = await runService(layer, (svc) => svc.resolveRoundById(created.id));
    expect(reloaded).toMatchObject({
      status: "rejected",
      rejectionReason: "Needs a clearer repo link",
    });

    await expect(
      runService(layer, (_svc, projects) =>
        projects.rejectProject(created.projectRecordId, "again"),
      ),
    ).rejects.toThrow("Only pending projects can be rejected");
  });

  it("opens a round immediately once its project is approved, and numbers rounds per project", async () => {
    const layer = freshLayer();
    const first = await runService(layer, (svc) => svc.createRound(baseInput));
    await approveProjectOf(layer, first);

    const second = await runService(layer, (svc) => svc.createRound(baseInput));
    expect(second.status).toBe("open");
    expect(second.projectRecordId).toBe(first.projectRecordId);
    expect([first.projectRoundNumber, second.projectRoundNumber]).toEqual([1, 2]);
  });

  it("blocks a second org from using an existing project's slug", async () => {
    const layer = freshLayer();
    await runService(layer, (svc) => svc.createRound(baseInput));
    await expect(
      runService(layer, (svc) => svc.createRound({ ...baseInput, ownerOrgId: "org-2" })),
    ).rejects.toThrow("belongs to another organization");
  });

  it("blocks new rounds while the project is pending or rejected", async () => {
    const layer = freshLayer();
    const first = await runService(layer, (svc) => svc.createRound(baseInput));
    await expect(runService(layer, (svc) => svc.createRound(baseInput))).rejects.toThrow(
      "awaiting admin approval",
    );

    await runService(layer, (_svc, projects) =>
      projects.rejectProject(first.projectRecordId, "Out of scope"),
    );
    await expect(runService(layer, (svc) => svc.createRound(baseInput))).rejects.toThrow(
      "This project was rejected: Out of scope",
    );
  });

  it("doesn't leave a project behind when round creation fails", async () => {
    const layer = freshLayer();
    await expect(
      runService(layer, (svc) => svc.createRound({ ...baseInput, ownerAccountId: null as never })),
    ).rejects.toThrow();
    const project = await runService(layer, (_svc, projects) =>
      projects.resolveProjectBySlug("my-project"),
    );
    expect(project).toBeNull();
  });

  it("stores a readme at creation and lets it be replaced", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, readme: "# Steps" }),
    );
    expect(created.readme).toBe("# Steps");

    const updated = await runService(layer, (svc) =>
      svc.updateRound(created.id, { readme: "# New" }),
    );
    expect(updated.readme).toBe("# New");

    await expect(
      runService(layer, (svc) => svc.updateRound(MISSING_ID, { readme: "x" })),
    ).rejects.toThrow("Round not found");
  });

  it("stores multiple formats and an optional repo URL", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) =>
      svc.createRound({
        ...baseInput,
        formats: ["written", "recorded", "issues"],
        repoUrl: "https://github.com/near/feedback",
      }),
    );
    expect(created.formats).toEqual(["written", "recorded", "issues"]);
    expect(created.repoUrl).toBe("https://github.com/near/feedback");
  });

  it("returns null when resolving an unknown round", async () => {
    const layer = freshLayer();
    expect(await runService(layer, (svc) => svc.resolveRoundById(MISSING_ID))).toBeNull();
  });

  it("adds participants idempotently, counts them, and removes them", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) => svc.createRound(baseInput));

    await runService(layer, (svc) => svc.addParticipant(round.id, "alice.near"));
    await runService(layer, (svc) => svc.addParticipant(round.id, "alice.near"));
    await runService(layer, (svc) => svc.addParticipant(round.id, "bob.near"));

    expect(
      await runService(layer, (svc) => svc.findParticipantAccount(round.id, ["alice.near"])),
    ).toBe("alice.near");
    expect(
      await runService(layer, (svc) => svc.findParticipantAccount(round.id, ["carol.near"])),
    ).toBeNull();

    const detail = await runService(layer, (svc) => svc.getRoundDetail(round.id));
    expect(detail?.participantCount).toBe(2);

    await runService(layer, (svc) => svc.removeParticipant(round.id, "alice.near"));
    const afterLeave = await runService(layer, (svc) => svc.getRoundDetail(round.id));
    expect(afterLeave?.participantCount).toBe(1);
    expect(
      await runService(layer, (svc) => svc.findParticipantAccount(round.id, ["alice.near"])),
    ).toBeNull();
  });

  it("stores written and recorded feedback and lists it for a round", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) => svc.createRound(baseInput));

    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: round.id,
        authorAccountId: "alice.near",
        format: "written",
        body: "Looks good",
        url: null,
      }),
    );
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: round.id,
        authorAccountId: "bob.near",
        format: "recorded",
        body: null,
        url: "https://example.com/rec",
      }),
    );

    const { items: thread } = await runService(layer, (svc) => svc.listFeedback(round.id));
    expect(thread).toHaveLength(2);
    expect(thread.map((e) => e.authorAccountId).sort()).toEqual(["alice.near", "bob.near"]);
    expect(thread.find((e) => e.format === "written")?.body).toBe("Looks good");
    expect(thread.find((e) => e.format === "recorded")?.url).toBe("https://example.com/rec");

    const empty = await runService(layer, (svc) => svc.listFeedback(MISSING_ID));
    expect(empty).toEqual({ items: [], nextCursor: null });
  });

  it("derives credit candidates and closes a round with credit", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, formats: ["written", "recorded"] }),
    );
    await approveProjectOf(layer, round);
    await runService(layer, (svc) => svc.addParticipant(round.id, "alice.near"));
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: round.id,
        authorAccountId: "alice.near",
        format: "written",
        body: "one",
        url: null,
      }),
    );
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: round.id,
        authorAccountId: "alice.near",
        format: "written",
        body: "two",
        url: null,
      }),
    );

    const candidates = await runService(layer, (svc) => svc.getCreditCandidates(round.id));
    expect(candidates).toEqual([{ accountId: "alice.near", writtenCount: 2, recordedCount: 0 }]);

    const closed = await runService(layer, (svc) =>
      svc.closeRound(round.id, [{ builderAccountId: "alice.near", contributedMeaningfully: true }]),
    );
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).toEqual(expect.any(String));

    const credits = await runService(layer, (svc) => svc.listRoundCredits(round.id));
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      builderAccountId: "alice.near",
      roundTitle: baseInput.title,
      contributedMeaningfully: true,
      writtenCount: 2,
      recordedCount: 0,
    });

    const reloaded = await runService(layer, (svc) => svc.resolveRoundById(round.id));
    expect(reloaded?.status).toBe("closed");
  });

  it("lists a builder's credited closed rounds newest-first, with an issues link", async () => {
    const layer = freshLayer();

    const withIssues = await runService(layer, (svc) =>
      svc.createRound({
        ...baseInput,
        title: "Round with issues",
        formats: ["written", "issues"],
        repoUrl: "https://github.com/near/feedback/",
      }),
    );
    await approveProjectOf(layer, withIssues);
    await runService(layer, (svc) => svc.addParticipant(withIssues.id, "tester.near"));
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: withIssues.id,
        authorAccountId: "tester.near",
        format: "written",
        body: "note",
        url: null,
      }),
    );
    await runService(layer, (svc) =>
      svc.closeRound(withIssues.id, [
        { builderAccountId: "tester.near", contributedMeaningfully: true, summary: "solid" },
      ]),
    );

    const writtenOnly = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, title: "Written-only round", formats: ["written"] }),
    );
    await runService(layer, (svc) => svc.addParticipant(writtenOnly.id, "tester.near"));
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: writtenOnly.id,
        authorAccountId: "tester.near",
        format: "written",
        body: "hi",
        url: null,
      }),
    );
    await runService(layer, (svc) =>
      svc.closeRound(writtenOnly.id, [
        { builderAccountId: "tester.near", contributedMeaningfully: false },
      ]),
    );

    const rounds = await runService(layer, (svc) => svc.listBuilderRounds("tester.near"));
    expect(rounds.map((r) => r.roundTitle)).toEqual(["Written-only round", "Round with issues"]);

    const issuesRound = rounds.find((r) => r.roundId === withIssues.id);
    expect(issuesRound).toMatchObject({
      projectSlug: baseInput.projectSlug,
      contributedMeaningfully: true,
      summary: "solid",
      writtenCount: 1,
      recordedCount: 0,
      issuesUrl: "https://github.com/near/feedback/issues",
    });

    const writtenRound = rounds.find((r) => r.roundId === writtenOnly.id);
    expect(writtenRound?.issuesUrl).toBeNull();
    expect(writtenRound?.closedAt).toEqual(expect.any(String));
  });

  it("does not surface open rounds or other builders' credit on a profile", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, formats: ["written"] }),
    );
    await approveProjectOf(layer, round);
    await runService(layer, (svc) => svc.addParticipant(round.id, "alice.near"));
    await runService(layer, (svc) =>
      svc.addFeedback({
        roundId: round.id,
        authorAccountId: "alice.near",
        format: "written",
        body: "hi",
        url: null,
      }),
    );

    expect(await runService(layer, (svc) => svc.listBuilderRounds("alice.near"))).toEqual([]);

    await runService(layer, (svc) =>
      svc.closeRound(round.id, [{ builderAccountId: "alice.near", contributedMeaningfully: true }]),
    );

    expect(await runService(layer, (svc) => svc.listBuilderRounds("alice.near"))).toHaveLength(1);
    expect(await runService(layer, (svc) => svc.listBuilderRounds("bob.near"))).toEqual([]);
  });

  it("rejects closing with a credit for a non-contributor", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) => svc.createRound(baseInput));
    await approveProjectOf(layer, round);
    await expect(
      runService(layer, (svc) =>
        svc.closeRound(round.id, [
          { builderAccountId: "ghost.near", contributedMeaningfully: true },
        ]),
      ),
    ).rejects.toThrow();
  });

  it("lists rounds and filters by status", async () => {
    const layer = freshLayer();
    const first = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, title: "First" }),
    );
    const second = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, projectSlug: "other-project", title: "Second" }),
    );
    await approveProjectOf(layer, first);
    await runService(layer, (_svc, projects) =>
      projects.rejectProject(second.projectRecordId, "No thanks"),
    );

    const all = await runService(layer, (svc) => svc.listRounds());
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(all).toHaveLength(2);

    const pending = await runService(layer, (svc) => svc.listRounds("pending"));
    expect(pending).toEqual([]);

    const open = await runService(layer, (svc) => svc.listRounds("open"));
    expect(open.map((r) => r.id)).toEqual([first.id]);

    const closed = await runService(layer, (svc) => svc.listRounds("closed"));
    expect(closed).toEqual([]);

    const rejected = await runService(layer, (svc) => svc.listRounds("rejected"));
    expect(rejected.map((r) => r.id)).toEqual([second.id]);
  });
});
