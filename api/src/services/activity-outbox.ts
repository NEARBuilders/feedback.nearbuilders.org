/**
 * Durable delivery for activity.nearbuilders.org events.
 *
 * activity is the sole source of truth for tester reputation (there is no local
 * points fallback), so a dropped event is a permanently wrong leaderboard. This
 * module turns emission into a two-step process:
 *
 *   1. `enqueueActivity(tx, item)` writes the intent inside the same
 *      transaction as the domain change, so the two commit or fail together.
 *   2. `createActivityOutboxWorker(...)` drains pending rows against the
 *      gateway with exponential backoff, and writes the returned event id back
 *      onto the subject row so a later retraction can reference it.
 *
 * Cancellation matters as much as retry: un-accepting feedback whose
 * `feedback.accepted` emit has not been delivered yet cancels the queued row
 * rather than emitting and immediately retracting it.
 */

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "../db";
import { activityOutbox, roundFeedback, rounds } from "../db/schema";
import type { ActivityEmitter, ActivityEventType } from "./activity-events";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Where the gateway's event id is written back to once delivered. */
export type ActivitySubjectKind = "round" | "feedback" | "feedback_accepted";

export interface ActivityEmitIntent {
  operation: "emit";
  eventType: ActivityEventType;
  actor: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  subjectKind?: ActivitySubjectKind;
  subjectId?: string;
}

export interface ActivityRetractIntent {
  operation: "retract";
  idempotencyKey: string;
  targetEventId: string;
  reason: string;
}

export type ActivityIntent = ActivityEmitIntent | ActivityRetractIntent;

const MAX_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_POLL_MS = 10_000;

export function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
}

type Executor = Database | Transaction;

/**
 * Queue an activity event. Call inside the transaction that performs the
 * domain write so the event cannot be lost if the process dies mid-request.
 *
 * Re-queuing the same `idempotencyKey` is a no-op, which makes retried
 * requests safe.
 */
export async function enqueueActivity(tx: Executor, intent: ActivityIntent): Promise<void> {
  const row =
    intent.operation === "emit"
      ? {
          operation: "emit" as const,
          eventType: intent.eventType,
          actor: intent.actor,
          payload: intent.payload,
          idempotencyKey: intent.idempotencyKey,
          subjectKind: intent.subjectKind ?? null,
          subjectId: intent.subjectId ?? null,
        }
      : {
          operation: "retract" as const,
          targetEventId: intent.targetEventId,
          reason: intent.reason,
          idempotencyKey: intent.idempotencyKey,
        };

  await tx.insert(activityOutbox).values(row).onConflictDoNothing();
}

/**
 * Drop a queued emit that has not been delivered yet, returning true when one
 * was cancelled. Used when a contribution is reversed before the worker runs,
 * so the gateway never sees an event that should not exist.
 */
export async function cancelPendingActivity(
  tx: Executor,
  idempotencyKey: string,
): Promise<boolean> {
  const cancelled = await tx
    .update(activityOutbox)
    .set({ status: "cancelled" })
    .where(
      and(eq(activityOutbox.idempotencyKey, idempotencyKey), eq(activityOutbox.status, "pending")),
    )
    .returning({ id: activityOutbox.id });
  return cancelled.length > 0;
}

export interface ActivityOutboxWorker {
  /** Deliver one batch of due rows. Returns how many were attempted. */
  drain(): Promise<number>;
  start(): void;
  stop(): void;
}

export interface ActivityOutboxWorkerOptions {
  db: Database;
  emitter: ActivityEmitter;
  batchSize?: number;
  pollMs?: number;
  logger?: { warn(message: string): void };
}

export function createActivityOutboxWorker(
  options: ActivityOutboxWorkerOptions,
): ActivityOutboxWorker {
  const { db, emitter } = options;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  const logger = options.logger ?? console;
  let timer: ReturnType<typeof setInterval> | null = null;
  let draining = false;

  async function writeBackEventId(
    subjectKind: string | null,
    subjectId: string | null,
    eventId: string,
  ): Promise<void> {
    if (!subjectKind || !subjectId) return;
    if (subjectKind === "round") {
      await db.update(rounds).set({ activityEventId: eventId }).where(eq(rounds.id, subjectId));
      return;
    }
    if (subjectKind === "feedback") {
      await db
        .update(roundFeedback)
        .set({ activityEventId: eventId })
        .where(eq(roundFeedback.id, subjectId));
      return;
    }
    if (subjectKind === "feedback_accepted") {
      await db
        .update(roundFeedback)
        .set({ acceptedActivityEventId: eventId })
        .where(eq(roundFeedback.id, subjectId));
    }
  }

  async function deliver(row: typeof activityOutbox.$inferSelect): Promise<void> {
    if (row.operation === "retract") {
      if (!row.targetEventId) {
        await db
          .update(activityOutbox)
          .set({ status: "cancelled", lastError: "no target event id" })
          .where(eq(activityOutbox.id, row.id));
        return;
      }
      await emitter.retract(row.targetEventId, row.reason ?? "retracted");
      await db
        .update(activityOutbox)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(activityOutbox.id, row.id));
      return;
    }

    const eventId = await emitter.submitRaw({
      eventType: row.eventType as ActivityEventType,
      actor: row.actor ?? "",
      idempotencyKey: row.idempotencyKey,
      payload: (row.payload ?? {}) as Record<string, never>,
    });

    // A disabled gateway yields no id and nothing to retry against; leaving the
    // row pending would spin forever, so park it as failed for visibility.
    if (!eventId) throw new Error("gateway returned no event id");

    await db
      .update(activityOutbox)
      .set({ status: "sent", sentAt: new Date(), eventId })
      .where(eq(activityOutbox.id, row.id));
    await writeBackEventId(row.subjectKind, row.subjectId, eventId);
  }

  async function fail(row: typeof activityOutbox.$inferSelect, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = attempts >= MAX_ATTEMPTS;
    await db
      .update(activityOutbox)
      .set({
        attempts,
        lastError: message,
        status: exhausted ? "failed" : "pending",
        nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      })
      .where(eq(activityOutbox.id, row.id));
    logger.warn(
      `[activity-outbox] ${row.operation} ${row.idempotencyKey} attempt ${attempts} failed: ${message}${
        exhausted ? " (giving up)" : ""
      }`,
    );
  }

  async function drain(): Promise<number> {
    const due = await db
      .select()
      .from(activityOutbox)
      .where(
        and(eq(activityOutbox.status, "pending"), lte(activityOutbox.nextAttemptAt, new Date())),
      )
      .orderBy(asc(activityOutbox.createdAt))
      .limit(batchSize);

    for (const row of due) {
      try {
        await deliver(row);
      } catch (error) {
        await fail(row, error);
      }
    }
    return due.length;
  }

  return {
    drain,
    start: () => {
      if (timer) return;
      timer = setInterval(() => {
        if (draining) return;
        draining = true;
        void drain()
          .catch((error) => {
            logger.warn(
              `[activity-outbox] drain failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          })
          .finally(() => {
            draining = false;
          });
      }, pollMs);
      // Never hold the process open just to poll an empty queue.
      timer.unref?.();
    },
    stop: () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  };
}

/** Rows parked after exhausting retries, for an operator to inspect. */
export async function listFailedActivity(db: Database, limit = 50) {
  return db
    .select()
    .from(activityOutbox)
    .where(eq(activityOutbox.status, "failed"))
    .orderBy(asc(activityOutbox.createdAt))
    .limit(limit);
}

/** Re-queue parked rows, e.g. after the gateway comes back. */
export async function retryFailedActivity(db: Database, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(activityOutbox)
    .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null })
    .where(and(eq(activityOutbox.status, "failed"), inArray(activityOutbox.id, ids)))
    .returning({ id: activityOutbox.id });
  return rows.length;
}

/** Queue depth by status, for the startup log and health checks. */
export async function activityOutboxDepth(db: Database): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: activityOutbox.status, total: sql<number>`count(*)::int` })
    .from(activityOutbox)
    .groupBy(activityOutbox.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
}
