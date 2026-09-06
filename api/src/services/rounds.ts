import { and, asc, count, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import {
  roundFeedback as roundFeedbackTable,
  roundParticipants as roundParticipantsTable,
  type roundStatus,
  rounds as roundsTable,
} from "../db/schema";

export type RoundStatus = (typeof roundStatus)["enumValues"][number];
export type RoundFormat = "issues" | "written" | "recorded";
export type RoundFeedbackFormat = "written" | "recorded";

export interface RoundRecord {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  title: string;
  description: string;
  formats: RoundFormat[];
  repoUrl: string | null;
  status: RoundStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CreateRoundInput {
  ownerAccountId: string;
  projectSlug: string;
  title: string;
  description: string;
  formats: RoundFormat[];
  repoUrl?: string | null;
}

export interface RoundDetailRecord extends RoundRecord {
  participantCount: number;
}

export interface RoundFeedbackRecord {
  id: string;
  roundId: string;
  authorAccountId: string;
  format: RoundFeedbackFormat;
  body: string | null;
  url: string | null;
  createdAt: string;
}

export interface AddFeedbackInput {
  roundId: string;
  authorAccountId: string;
  format: RoundFeedbackFormat;
  body: string | null;
  url: string | null;
}

export interface RoundsService {
  createRound(input: CreateRoundInput): Promise<RoundRecord>;
  resolveRoundById(id: string): Promise<RoundRecord | null>;
  getRoundDetail(id: string): Promise<RoundDetailRecord | null>;
  listRounds(status?: RoundStatus): Promise<RoundRecord[]>;
  addParticipant(roundId: string, accountId: string): Promise<void>;
  removeParticipant(roundId: string, accountId: string): Promise<void>;
  hasParticipant(roundId: string, accountId: string): Promise<boolean>;
  addFeedback(input: AddFeedbackInput): Promise<RoundFeedbackRecord>;
  listFeedback(roundId: string): Promise<RoundFeedbackRecord[]>;
}

export class RoundsTag extends Context.Tag("api/Rounds")<RoundsService, RoundsService>() {}

type RoundRow = typeof roundsTable.$inferSelect;

function toRoundRecord(row: RoundRow): RoundRecord {
  return {
    id: row.id,
    ownerAccountId: row.ownerAccountId,
    projectSlug: row.projectSlug,
    title: row.title,
    description: row.description,
    formats: row.formats as RoundFormat[],
    repoUrl: row.repoUrl,
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : null,
  };
}

type RoundFeedbackRow = typeof roundFeedbackTable.$inferSelect;

function toFeedbackRecord(row: RoundFeedbackRow): RoundFeedbackRecord {
  return {
    id: row.id,
    roundId: row.roundId,
    authorAccountId: row.authorAccountId,
    format: row.format,
    body: row.body,
    url: row.url,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function toOrpcError(error: unknown): ORPCError<string, unknown> {
  return error instanceof ORPCError
    ? error
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : String(error),
      });
}

export const RoundsLive = Layer.effect(
  RoundsTag,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const service: RoundsService = {
      createRound: async (input) => {
        try {
          const [row] = await db
            .insert(roundsTable)
            .values({
              ownerAccountId: input.ownerAccountId,
              projectSlug: input.projectSlug,
              title: input.title,
              description: input.description,
              formats: input.formats,
              repoUrl: input.repoUrl ?? null,
            })
            .returning();

          if (!row) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create round" });
          }

          return toRoundRecord(row);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      resolveRoundById: async (id) => {
        try {
          const [row] = await db.select().from(roundsTable).where(eq(roundsTable.id, id)).limit(1);
          return row ? toRoundRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listRounds: async (status) => {
        try {
          const rows = await db
            .select()
            .from(roundsTable)
            .where(status ? eq(roundsTable.status, status) : undefined)
            .orderBy(desc(roundsTable.createdAt));
          return rows.map(toRoundRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      getRoundDetail: async (id) => {
        try {
          const [row] = await db.select().from(roundsTable).where(eq(roundsTable.id, id)).limit(1);
          if (!row) return null;
          const [countRow] = await db
            .select({ value: count() })
            .from(roundParticipantsTable)
            .where(eq(roundParticipantsTable.roundId, id));
          return { ...toRoundRecord(row), participantCount: countRow?.value ?? 0 };
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      addParticipant: async (roundId, accountId) => {
        try {
          await db
            .insert(roundParticipantsTable)
            .values({ roundId, accountId })
            .onConflictDoNothing();
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      removeParticipant: async (roundId, accountId) => {
        try {
          await db
            .delete(roundParticipantsTable)
            .where(
              and(
                eq(roundParticipantsTable.roundId, roundId),
                eq(roundParticipantsTable.accountId, accountId),
              ),
            );
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      hasParticipant: async (roundId, accountId) => {
        try {
          const [row] = await db
            .select({ id: roundParticipantsTable.id })
            .from(roundParticipantsTable)
            .where(
              and(
                eq(roundParticipantsTable.roundId, roundId),
                eq(roundParticipantsTable.accountId, accountId),
              ),
            )
            .limit(1);
          return !!row;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      addFeedback: async (input) => {
        try {
          const [row] = await db
            .insert(roundFeedbackTable)
            .values({
              roundId: input.roundId,
              authorAccountId: input.authorAccountId,
              format: input.format,
              body: input.body,
              url: input.url,
            })
            .returning();
          if (!row) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to post feedback" });
          }
          return toFeedbackRecord(row);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listFeedback: async (roundId) => {
        try {
          const rows = await db
            .select()
            .from(roundFeedbackTable)
            .where(eq(roundFeedbackTable.roundId, roundId))
            .orderBy(asc(roundFeedbackTable.createdAt));
          return rows.map(toFeedbackRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
