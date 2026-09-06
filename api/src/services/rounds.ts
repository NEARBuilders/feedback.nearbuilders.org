import { and, asc, count, desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import {
  roundCredits as roundCreditsTable,
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

export interface CreditCandidate {
  accountId: string;
  writtenCount: number;
  recordedCount: number;
}

export interface RoundCreditRecord {
  id: string;
  roundId: string;
  builderAccountId: string;
  projectSlug: string;
  roundTitle: string;
  contributedMeaningfully: boolean;
  summary: string | null;
  writtenCount: number;
  recordedCount: number;
  createdAt: string;
}

export interface CloseRoundCreditInput {
  builderAccountId: string;
  contributedMeaningfully: boolean;
  summary?: string;
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
  getCreditCandidates(roundId: string): Promise<CreditCandidate[]>;
  closeRound(roundId: string, credits: CloseRoundCreditInput[]): Promise<RoundDetailRecord>;
  listRoundCredits(roundId: string): Promise<RoundCreditRecord[]>;
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

type RoundCreditRow = typeof roundCreditsTable.$inferSelect;

function toCreditRecord(row: RoundCreditRow): RoundCreditRecord {
  return {
    id: row.id,
    roundId: row.roundId,
    builderAccountId: row.builderAccountId,
    projectSlug: row.projectSlug,
    roundTitle: row.roundTitle,
    contributedMeaningfully: row.contributedMeaningfully,
    summary: row.summary,
    writtenCount: row.writtenCount,
    recordedCount: row.recordedCount,
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

      getCreditCandidates: async (roundId) => {
        try {
          const rows = await db
            .select({
              accountId: roundFeedbackTable.authorAccountId,
              format: roundFeedbackTable.format,
            })
            .from(roundFeedbackTable)
            .where(eq(roundFeedbackTable.roundId, roundId));

          const byAccount = new Map<string, CreditCandidate>();
          for (const row of rows) {
            const entry = byAccount.get(row.accountId) ?? {
              accountId: row.accountId,
              writtenCount: 0,
              recordedCount: 0,
            };
            if (row.format === "written") entry.writtenCount += 1;
            else entry.recordedCount += 1;
            byAccount.set(row.accountId, entry);
          }
          return [...byAccount.values()].sort((a, b) => a.accountId.localeCompare(b.accountId));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      closeRound: async (roundId, credits) => {
        try {
          const detail = await db.transaction(async (tx) => {
            const [round] = await tx
              .select()
              .from(roundsTable)
              .where(eq(roundsTable.id, roundId))
              .limit(1);
            if (!round) {
              throw new ORPCError("NOT_FOUND", { message: "Round not found" });
            }
            if (round.status !== "open") {
              throw new ORPCError("BAD_REQUEST", { message: "This round is already closed" });
            }

            const feedbackRows = await tx
              .select({
                accountId: roundFeedbackTable.authorAccountId,
                format: roundFeedbackTable.format,
              })
              .from(roundFeedbackTable)
              .where(eq(roundFeedbackTable.roundId, roundId));

            const counts = new Map<string, { written: number; recorded: number }>();
            for (const row of feedbackRows) {
              const entry = counts.get(row.accountId) ?? { written: 0, recorded: 0 };
              if (row.format === "written") entry.written += 1;
              else entry.recorded += 1;
              counts.set(row.accountId, entry);
            }

            for (const credit of credits) {
              if (!counts.has(credit.builderAccountId)) {
                throw new ORPCError("BAD_REQUEST", {
                  message: `${credit.builderAccountId} did not post feedback and can't be credited`,
                });
              }
              const c = counts.get(credit.builderAccountId)!;
              await tx
                .insert(roundCreditsTable)
                .values({
                  roundId,
                  builderAccountId: credit.builderAccountId,
                  projectSlug: round.projectSlug,
                  roundTitle: round.title,
                  contributedMeaningfully: credit.contributedMeaningfully,
                  summary: credit.summary ?? null,
                  writtenCount: c.written,
                  recordedCount: c.recorded,
                })
                .onConflictDoUpdate({
                  target: [roundCreditsTable.roundId, roundCreditsTable.builderAccountId],
                  set: {
                    contributedMeaningfully: credit.contributedMeaningfully,
                    summary: credit.summary ?? null,
                    writtenCount: c.written,
                    recordedCount: c.recorded,
                  },
                });
            }

            const now = new Date();
            await tx
              .update(roundsTable)
              .set({ status: "closed", closedAt: now, updatedAt: now })
              .where(eq(roundsTable.id, roundId));

            const [countRow] = await tx
              .select({ value: count() })
              .from(roundParticipantsTable)
              .where(eq(roundParticipantsTable.roundId, roundId));

            return {
              ...toRoundRecord({ ...round, status: "closed", closedAt: now, updatedAt: now }),
              participantCount: countRow?.value ?? 0,
            };
          });
          return detail;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listRoundCredits: async (roundId) => {
        try {
          const rows = await db
            .select()
            .from(roundCreditsTable)
            .where(eq(roundCreditsTable.roundId, roundId))
            .orderBy(asc(roundCreditsTable.builderAccountId));
          return rows.map(toCreditRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
