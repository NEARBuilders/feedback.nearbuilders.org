import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import {
  type notificationKind,
  notifications as notificationsTable,
  roundParticipants as roundParticipantsTable,
  rounds as roundsTable,
} from "../db/schema";

export type NotificationKindValue = (typeof notificationKind)["enumValues"][number];

export interface NotificationRecord {
  id: string;
  roundId: string;
  roundTitle: string;
  kind: NotificationKindValue;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationRecord[];
  unreadCount: number;
}

export interface NotifyParticipantsInput {
  roundId: string;
  kind: NotificationKindValue;
  title: string;
  body: string;
}

export interface NotificationsService {
  listForAccount(accountId: string, limit: number): Promise<NotificationList>;
  markRead(accountId: string, notificationId: string): Promise<NotificationRecord | null>;
  markAllRead(accountId: string): Promise<number>;
  notifyParticipants(input: NotifyParticipantsInput): Promise<number>;
}

export class NotificationsTag extends Context.Tag("api/Notifications")<
  NotificationsService,
  NotificationsService
>() {}

const INSERT_CHUNK_SIZE = 500;

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function toOrpcError(error: unknown): ORPCError<string, unknown> {
  return error instanceof ORPCError
    ? error
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : String(error),
      });
}

const recordColumns = {
  id: notificationsTable.id,
  roundId: notificationsTable.roundId,
  roundTitle: roundsTable.title,
  kind: notificationsTable.kind,
  title: notificationsTable.title,
  body: notificationsTable.body,
  readAt: notificationsTable.readAt,
  createdAt: notificationsTable.createdAt,
};

function toRecord(row: {
  id: string;
  roundId: string;
  roundTitle: string;
  kind: NotificationKindValue;
  title: string;
  body: string;
  readAt: Date | string | null;
  createdAt: Date | string;
}): NotificationRecord {
  return {
    id: row.id,
    roundId: row.roundId,
    roundTitle: row.roundTitle,
    kind: row.kind,
    title: row.title,
    body: row.body,
    readAt: row.readAt === null ? null : iso(row.readAt),
    createdAt: iso(row.createdAt),
  };
}

export const NotificationsLive = Layer.effect(
  NotificationsTag,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const service: NotificationsService = {
      listForAccount: async (accountId, limit) => {
        try {
          const rows = await db
            .select(recordColumns)
            .from(notificationsTable)
            .innerJoin(roundsTable, eq(roundsTable.id, notificationsTable.roundId))
            .where(eq(notificationsTable.recipientAccountId, accountId))
            .orderBy(desc(notificationsTable.createdAt))
            .limit(limit);
          const [unread] = await db
            .select({ value: sql<number>`count(*)::int` })
            .from(notificationsTable)
            .where(
              and(
                eq(notificationsTable.recipientAccountId, accountId),
                isNull(notificationsTable.readAt),
              ),
            );
          return { items: rows.map(toRecord), unreadCount: unread?.value ?? 0 };
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      markRead: async (accountId, notificationId) => {
        try {
          const updated = await db
            .update(notificationsTable)
            .set({ readAt: sql`coalesce(${notificationsTable.readAt}, now())` })
            .where(
              and(
                eq(notificationsTable.id, notificationId),
                eq(notificationsTable.recipientAccountId, accountId),
              ),
            )
            .returning({ id: notificationsTable.id });
          if (updated.length === 0) return null;
          const [row] = await db
            .select(recordColumns)
            .from(notificationsTable)
            .innerJoin(roundsTable, eq(roundsTable.id, notificationsTable.roundId))
            .where(eq(notificationsTable.id, notificationId))
            .limit(1);
          return row ? toRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      markAllRead: async (accountId) => {
        try {
          const updated = await db
            .update(notificationsTable)
            .set({ readAt: sql`now()` })
            .where(
              and(
                eq(notificationsTable.recipientAccountId, accountId),
                isNull(notificationsTable.readAt),
              ),
            )
            .returning({ id: notificationsTable.id });
          return updated.length;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      notifyParticipants: async (input) => {
        try {
          const participants = await db
            .select({ accountId: roundParticipantsTable.accountId })
            .from(roundParticipantsTable)
            .where(eq(roundParticipantsTable.roundId, input.roundId));
          if (participants.length === 0) return 0;
          const rows = participants.map((participant) => ({
            recipientAccountId: participant.accountId,
            roundId: input.roundId,
            kind: input.kind,
            title: input.title,
            body: input.body,
          }));
          await db.transaction(async (tx) => {
            for (const batch of chunk(rows, INSERT_CHUNK_SIZE)) {
              await tx.insert(notificationsTable).values(batch);
            }
          });
          return participants.length;
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
