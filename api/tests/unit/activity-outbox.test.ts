import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { PluginIdTag } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import { DatabaseLive, DatabaseTag } from "@/db/layer";
import { activityOutbox, roundFeedback } from "@/db/schema";
import type { ActivityEmitter } from "@/services/activity-events";
import {
  backoffMs,
  cancelPendingActivity,
  createActivityOutboxWorker,
  enqueueActivity,
} from "@/services/activity-outbox";
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

/**
 * Unlike the other service tests, these assert on outbox rows directly, so the
 * database has to stay reachable alongside the services rather than being
 * consumed by `Layer.provide`. The shared `dbLayer` reference is what keeps
 * Effect from building a second PGlite instance.
 */
function freshLayer() {
  const dir = mkdtempSync(join(tmpdir(), "api-outbox-"));
  activeDir = dir;
  const dbLayer = DatabaseLive(`pglite:${dir}`).pipe(
    Layer.provide(Layer.succeed(PluginIdTag, "api")),
  );
  return Layer.mergeAll(
    RoundsLive.pipe(Layer.provide(dbLayer)),
    ProjectRecordsLive.pipe(Layer.provide(dbLayer)),
    dbLayer,
  );
}

type Harness = {
  db: Database;
  rounds: RoundsService;
  projects: ProjectRecordsService;
};

function withHarness<A>(fn: (harness: Harness) => Promise<A>): Promise<A> {
  const layer = freshLayer();
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const db = yield* DatabaseTag;
        const rounds = yield* RoundsTag;
        const projects = yield* ProjectRecordsTag;
        return yield* Effect.promise(() => fn({ db, rounds, projects }));
      }).pipe(
        Effect.provide(
          layer as unknown as Layer.Layer<
            RoundsService | ProjectRecordsService | Database,
            never,
            never
          >,
        ),
      ),
    ),
  );
}

/** Emitter double: records submissions and hands back predictable event ids. */
function fakeEmitter(overrides: Partial<ActivityEmitter> = {}): ActivityEmitter {
  let n = 0;
  return {
    enabled: true,
    readable: true,
    submitRaw: vi.fn(async () => `event-${++n}`),
    emitRoundOpened: vi.fn(async () => null),
    emitFeedbackPosted: vi.fn(async () => null),
    emitRoundClosed: vi.fn(async () => null),
    emitCreditAwarded: vi.fn(async () => null),
    retract: vi.fn(async () => undefined),
    leaderboard: vi.fn(async () => null),
    endorsements: vi.fn(async () => null),
    listActorEvents: vi.fn(async () => null),
    ...overrides,
  } as ActivityEmitter;
}

async function openRoundWithFeedback(harness: Harness, slug: string) {
  const round = await harness.rounds.createRound({
    ownerAccountId: "owner.near",
    ownerOrgId: "org-1",
    projectSlug: slug,
    title: "Try it",
    description: "Please test",
    formats: ["written"],
  });
  await harness.projects.approveProject(round.projectRecordId);
  await harness.rounds.addParticipant(round.id, "tester.near");
  const feedback = await harness.rounds.addFeedback({
    roundId: round.id,
    authorAccountId: "tester.near",
    format: "written",
    body: "Found a bug",
    url: null,
  });
  return { round, feedback };
}

describe("backoffMs", () => {
  it("grows exponentially and then holds at the ceiling", () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(3)).toBe(20_000);
    expect(backoffMs(99)).toBe(15 * 60 * 1000);
  });
});

describe("enqueueActivity", () => {
  it("queues an emit and ignores a duplicate idempotency key", async () => {
    await withHarness(async ({ db }) => {
      const intent = {
        operation: "emit" as const,
        eventType: "feedback.accepted" as const,
        actor: "tester.near",
        idempotencyKey: "feedback.accepted:abc",
        payload: { feedbackId: "abc" },
      };
      await enqueueActivity(db, intent);
      await enqueueActivity(db, intent);

      const rows = await db.select().from(activityOutbox);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        status: "pending",
        attempts: 0,
      });
    });
  });
});

describe("cancelPendingActivity", () => {
  it("cancels a pending row and reports it, but leaves a delivered one alone", async () => {
    await withHarness(async ({ db }) => {
      await enqueueActivity(db, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        idempotencyKey: "key-pending",
        payload: {},
      });
      expect(await cancelPendingActivity(db, "key-pending")).toBe(true);
      const [cancelled] = await db
        .select()
        .from(activityOutbox)
        .where(eq(activityOutbox.idempotencyKey, "key-pending"));
      expect(cancelled?.status).toBe("cancelled");

      // Cancelling again is a no-op, which is what stops a delivered event
      // from being silently dropped instead of retracted.
      expect(await cancelPendingActivity(db, "key-pending")).toBe(false);
    });
  });
});

describe("the outbox worker", () => {
  it("delivers a queued emit and writes the event id back onto its subject", async () => {
    await withHarness(async (harness) => {
      const { db } = harness;
      const { feedback } = await openRoundWithFeedback(harness, "outbox-deliver");
      await enqueueActivity(db, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        idempotencyKey: `feedback.accepted:${feedback.id}`,
        payload: { feedbackId: feedback.id },
        subjectKind: "feedback_accepted",
        subjectId: feedback.id,
      });

      const emitter = fakeEmitter();
      const worker = createActivityOutboxWorker({ db, emitter });
      expect(await worker.drain()).toBe(1);

      const [row] = await db.select().from(activityOutbox);
      expect(row).toMatchObject({ status: "sent", eventId: "event-1" });

      const [stored] = await db
        .select()
        .from(roundFeedback)
        .where(eq(roundFeedback.id, feedback.id));
      expect(stored?.acceptedActivityEventId).toBe("event-1");
    });
  });

  it("keeps a failed delivery pending and backs off, rather than dropping it", async () => {
    await withHarness(async ({ db }) => {
      await enqueueActivity(db, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        idempotencyKey: "key-retry",
        payload: {},
      });

      const emitter = fakeEmitter({
        submitRaw: vi.fn(async () => {
          throw new Error("gateway down");
        }),
      });
      const worker = createActivityOutboxWorker({ db, emitter, logger: { warn: () => {} } });
      await worker.drain();

      const [row] = await db.select().from(activityOutbox);
      expect(row).toMatchObject({ status: "pending", attempts: 1, lastError: "gateway down" });
      expect(row?.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("parks a row as failed once retries are exhausted", async () => {
    await withHarness(async ({ db }) => {
      await enqueueActivity(db, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        idempotencyKey: "key-exhausted",
        payload: {},
      });
      // Pretend this row has already burned through its retries.
      await db.update(activityOutbox).set({ attempts: 7 });

      const emitter = fakeEmitter({
        submitRaw: vi.fn(async () => {
          throw new Error("still down");
        }),
      });
      const worker = createActivityOutboxWorker({ db, emitter, logger: { warn: () => {} } });
      await worker.drain();

      const [row] = await db.select().from(activityOutbox);
      expect(row).toMatchObject({ status: "failed", attempts: 8 });
    });
  });

  it("delivers a retraction through the emitter", async () => {
    await withHarness(async ({ db }) => {
      await enqueueActivity(db, {
        operation: "retract",
        idempotencyKey: "retract:event-9",
        targetEventId: "event-9",
        reason: "feedback no longer accepted",
      });

      const emitter = fakeEmitter();
      const worker = createActivityOutboxWorker({ db, emitter });
      await worker.drain();

      expect(emitter.retract).toHaveBeenCalledWith("event-9", "feedback no longer accepted");
      const [row] = await db.select().from(activityOutbox);
      expect(row?.status).toBe("sent");
    });
  });

  it("skips rows that are not due yet", async () => {
    await withHarness(async ({ db }) => {
      await enqueueActivity(db, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: "tester.near",
        idempotencyKey: "key-later",
        payload: {},
      });
      await db.update(activityOutbox).set({ nextAttemptAt: new Date(Date.now() + 60_000) });

      const worker = createActivityOutboxWorker({ db, emitter: fakeEmitter() });
      expect(await worker.drain()).toBe(0);
    });
  });
});

describe("accepting feedback", () => {
  it("queues feedback.accepted for the author when an owner resolves it", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round, feedback } = await openRoundWithFeedback(harness, "accept-emit");

      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");

      const rows = await db.select().from(activityOutbox);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        operation: "emit",
        eventType: "feedback.accepted",
        // The tester earns the credit, not the owner who accepted it.
        actor: "tester.near",
        subjectKind: "feedback_accepted",
        subjectId: feedback.id,
        status: "pending",
      });
      // The body must never reach activity: private rounds depend on it (#101).
      expect(JSON.stringify(rows[0]?.payload)).not.toContain("Found a bug");
    });
  });

  it("does not re-queue when the status is set to resolved again", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round, feedback } = await openRoundWithFeedback(harness, "accept-twice");

      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");
      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");

      expect(await db.select().from(activityOutbox)).toHaveLength(1);
    });
  });

  it("cancels the queued emit when acceptance is reversed before delivery", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round, feedback } = await openRoundWithFeedback(harness, "accept-undo");

      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");
      await rounds.setFeedbackStatus(round.id, [feedback.id], "dismissed");

      const rows = await db.select().from(activityOutbox);
      // Cancelled in place: the gateway never sees an event it would have to retract.
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("cancelled");
    });
  });

  it("retracts the delivered event when acceptance is reversed after delivery", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round, feedback } = await openRoundWithFeedback(harness, "accept-retract");

      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");
      const worker = createActivityOutboxWorker({ db, emitter: fakeEmitter() });
      await worker.drain();

      await rounds.setFeedbackStatus(round.id, [feedback.id], "unresolved");

      const retraction = (await db.select().from(activityOutbox)).find(
        (row) => row.operation === "retract",
      );
      expect(retraction).toMatchObject({
        targetEventId: "event-1",
        reason: "feedback no longer accepted",
        status: "pending",
      });

      const [stored] = await db
        .select()
        .from(roundFeedback)
        .where(eq(roundFeedback.id, feedback.id));
      expect(stored?.acceptedActivityEventId).toBeNull();
    });
  });

  it("treats re-acceptance as a new event rather than a deduped replay", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round, feedback } = await openRoundWithFeedback(harness, "accept-again");

      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");
      const worker = createActivityOutboxWorker({ db, emitter: fakeEmitter() });
      await worker.drain();
      await rounds.setFeedbackStatus(round.id, [feedback.id], "dismissed");
      await rounds.setFeedbackStatus(round.id, [feedback.id], "resolved");

      const emits = (await db.select().from(activityOutbox)).filter(
        (row) => row.eventType === "feedback.accepted",
      );
      expect(emits).toHaveLength(2);
      expect(new Set(emits.map((row) => row.idempotencyKey)).size).toBe(2);
    });
  });

  it("queues one event per item when feedback is accepted in bulk", async () => {
    await withHarness(async (harness) => {
      const { db, rounds } = harness;
      const { round } = await openRoundWithFeedback(harness, "accept-bulk");
      const second = await rounds.addFeedback({
        roundId: round.id,
        authorAccountId: "tester.near",
        format: "written",
        body: "And another",
        url: null,
      });
      const all = await rounds.listFeedback(round.id, {});

      await rounds.setFeedbackStatus(
        round.id,
        all.items.map((item) => item.id),
        "resolved",
      );

      const emits = (await db.select().from(activityOutbox)).filter(
        (row) => row.eventType === "feedback.accepted",
      );
      expect(emits).toHaveLength(2);
      expect(emits.map((row) => row.subjectId).sort()).toEqual(
        [second.id, ...all.items.map((i) => i.id)]
          .filter((id, i, xs) => xs.indexOf(id) === i)
          .sort(),
      );
    });
  });
});
