import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginIdTag } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseLive } from "@/db/layer";
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
  return RoundsLive.pipe(
    Layer.provide(DatabaseLive(`pglite:${dir}`)),
    Layer.provide(Layer.succeed(PluginIdTag, "api")),
  );
}

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

async function runService<A>(
  layer: Layer.Layer<RoundsService, unknown, never>,
  fn: (svc: RoundsService) => Promise<A>,
): Promise<A> {
  const effect = Effect.gen(function* () {
    const svc = yield* RoundsTag;
    return yield* Effect.tryPromise({ try: () => fn(svc), catch: (error) => error });
  });
  return Effect.runPromise(Effect.provide(effect, layer));
}

const baseInput = {
  ownerAccountId: "owner.near",
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

describe("RoundsService", () => {
  it("creates a round open by default and resolves it by id", async () => {
    const layer = freshLayer();
    const created = await runService(layer, (svc) => svc.createRound(baseInput));

    expect(created).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: "my-project",
      formats: ["written"],
      repoUrl: null,
      status: "open",
    });
    expect(created.id).toEqual(expect.any(String));
    expect(created.closedAt).toBeNull();

    const resolved = await runService(layer, (svc) => svc.resolveRoundById(created.id));
    expect(resolved?.id).toBe(created.id);
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

    expect(await runService(layer, (svc) => svc.hasParticipant(round.id, "alice.near"))).toBe(true);
    expect(await runService(layer, (svc) => svc.hasParticipant(round.id, "carol.near"))).toBe(
      false,
    );

    const detail = await runService(layer, (svc) => svc.getRoundDetail(round.id));
    expect(detail?.participantCount).toBe(2);

    await runService(layer, (svc) => svc.removeParticipant(round.id, "alice.near"));
    const afterLeave = await runService(layer, (svc) => svc.getRoundDetail(round.id));
    expect(afterLeave?.participantCount).toBe(1);
    expect(await runService(layer, (svc) => svc.hasParticipant(round.id, "alice.near"))).toBe(
      false,
    );
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

    const thread = await runService(layer, (svc) => svc.listFeedback(round.id));
    expect(thread).toHaveLength(2);
    expect(thread.map((e) => e.authorAccountId).sort()).toEqual(["alice.near", "bob.near"]);
    expect(thread.find((e) => e.format === "written")?.body).toBe("Looks good");
    expect(thread.find((e) => e.format === "recorded")?.url).toBe("https://example.com/rec");

    const empty = await runService(layer, (svc) => svc.listFeedback(MISSING_ID));
    expect(empty).toEqual([]);
  });

  it("derives credit candidates and closes a round with credit", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) =>
      svc.createRound({ ...baseInput, formats: ["written", "recorded"] }),
    );
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

  it("rejects closing with a credit for a non-contributor", async () => {
    const layer = freshLayer();
    const round = await runService(layer, (svc) => svc.createRound(baseInput));
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
      svc.createRound({ ...baseInput, title: "Second" }),
    );

    const all = await runService(layer, (svc) => svc.listRounds());
    expect(all.map((r) => r.id)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(all).toHaveLength(2);

    const open = await runService(layer, (svc) => svc.listRounds("open"));
    expect(open).toHaveLength(2);

    const closed = await runService(layer, (svc) => svc.listRounds("closed"));
    expect(closed).toEqual([]);
  });
});
