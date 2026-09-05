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
});
