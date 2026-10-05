import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import {
  projectRoundCounters as projectRoundCountersTable,
  roundCredits as roundCreditsTable,
  type roundFeedbackStatus,
  roundFeedback as roundFeedbackTable,
  roundParticipants as roundParticipantsTable,
  type roundStatus,
  rounds as roundsTable,
} from "../db/schema";
import { ensureProject } from "./project-records";

export type RoundStatus = (typeof roundStatus)["enumValues"][number];
export type RoundFormat = "issues" | "written" | "recorded";
export type RoundFeedbackFormat = "written" | "recorded";
export type RoundFeedbackStatus = (typeof roundFeedbackStatus)["enumValues"][number];

export interface RoundParticipantRecord {
  accountId: string;
  joinedAt: string;
}

export interface RoundRecord {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  projectId: string | null;
  /** The projects-table row this round belongs to (#69). */
  projectRecordId: string;
  projectRoundNumber: number;
  title: string;
  description: string;
  /** Markdown for testers: what to test and how (#71). Empty when the owner hasn't written one. */
  readme: string;
  formats: RoundFormat[];
  repoUrl: string | null;
  status: RoundStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  activityEventId: string | null;
}

export interface CreateRoundInput {
  ownerAccountId: string;
  /** The requester's active organization; owns the project if this request creates it. */
  ownerOrgId: string;
  projectSlug: string;
  /** Display name for a newly created project; defaults to the slug. */
  projectName?: string;
  projectId?: string | null;
  title: string;
  description: string;
  readme?: string;
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
  status: RoundFeedbackStatus;
  createdAt: string;
  activityEventId: string | null;
  nostrEventId: string | null;
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

export interface BuilderRoundRecord {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  repoUrl: string | null;
  issuesUrl: string | null;
  contributedMeaningfully: boolean;
  summary: string | null;
  writtenCount: number;
  recordedCount: number;
  closedAt: string;
  creditedAt: string;
}

export interface MyJoinedRoundRecord {
  roundId: string;
  roundTitle: string;
  projectSlug: string;
  status: RoundStatus;
  formats: RoundFormat[];
  participantCount: number;
  joinedAt: string;
}

export interface CloseRoundCreditInput {
  builderAccountId: string;
  contributedMeaningfully: boolean;
  summary?: string;
}

export interface DeletedRoundResult {
  activityEventId: string | null;
}

export interface DeletedFeedbackResult {
  roundId: string;
  activityEventId: string | null;
}

export interface RoundsService {
  /** Maps round id -> emitted activity event id, for rounds that have one. */
  listRoundActivityEventIds(roundIds: string[]): Promise<Record<string, string>>;
  /**
   * Creates a round under the project for `projectSlug`, creating that project
   * as `pending` if it's new. The round opens immediately when the project is
   * already approved, and otherwise waits as `pending` for the project decision.
   */
  createRound(input: CreateRoundInput): Promise<RoundRecord>;
  updateRoundReadme(roundId: string, readme: string): Promise<RoundRecord>;
  resolveRoundById(id: string): Promise<RoundRecord | null>;
  getRoundDetail(id: string): Promise<RoundDetailRecord | null>;
  listRounds(status?: RoundStatus): Promise<RoundDetailRecord[]>;
  addParticipant(roundId: string, accountId: string): Promise<void>;
  removeParticipant(roundId: string, accountId: string): Promise<void>;
  hasParticipant(roundId: string, accountId: string): Promise<boolean>;
  addFeedback(input: AddFeedbackInput): Promise<RoundFeedbackRecord>;
  listFeedback(roundId: string): Promise<RoundFeedbackRecord[]>;
  setFeedbackStatus(
    roundId: string,
    feedbackIds: string[],
    status: RoundFeedbackStatus,
  ): Promise<RoundFeedbackRecord[]>;
  listParticipants(roundId: string): Promise<RoundParticipantRecord[]>;
  getCreditCandidates(roundId: string): Promise<CreditCandidate[]>;
  closeRound(roundId: string, credits: CloseRoundCreditInput[]): Promise<RoundDetailRecord>;
  listRoundCredits(roundId: string): Promise<RoundCreditRecord[]>;
  listBuilderRounds(accountId: string): Promise<BuilderRoundRecord[]>;
  listMyJoinedRounds(accountId: string): Promise<MyJoinedRoundRecord[]>;
  setRoundActivityEventId(roundId: string, eventId: string): Promise<void>;
  setFeedbackActivityEventId(feedbackId: string, eventId: string): Promise<void>;
  setFeedbackNostrEventId(feedbackId: string, nostrEventId: string): Promise<void>;
  deleteRound(roundId: string): Promise<DeletedRoundResult | null>;
  deleteFeedback(feedbackId: string): Promise<DeletedFeedbackResult | null>;
}

function toIssuesUrl(formats: RoundFormat[], repoUrl: string | null): string | null {
  if (!repoUrl || !formats.includes("issues")) return null;
  return `${repoUrl.replace(/\/+$/, "")}/issues`;
}

export class RoundsTag extends Context.Tag("api/Rounds")<RoundsService, RoundsService>() {}

type RoundRow = typeof roundsTable.$inferSelect;

export function toRoundRecord(row: RoundRow): RoundRecord {
  return {
    id: row.id,
    ownerAccountId: row.ownerAccountId,
    projectSlug: row.projectSlug,
    projectId: row.projectId,
    projectRecordId: row.projectRecordId,
    projectRoundNumber: row.projectRoundNumber,
    title: row.title,
    description: row.description,
    readme: row.readme,
    formats: row.formats as RoundFormat[],
    repoUrl: row.repoUrl,
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    closedAt: row.closedAt instanceof Date ? row.closedAt.toISOString() : null,
    rejectedAt: row.rejectedAt instanceof Date ? row.rejectedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    activityEventId: row.activityEventId,
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
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    activityEventId: row.activityEventId,
    nostrEventId: row.nostrEventId,
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
          const row = await db.transaction(async (tx) => {
            const slug = input.projectSlug.trim();
            const { project, created } = await ensureProject(tx, {
              slug,
              name: input.projectName?.trim() || slug,
              ownerOrgId: input.ownerOrgId,
              requesterAccountId: input.ownerAccountId,
              nearbuildersProjectId: input.projectId ?? null,
            });
            // The request that creates a project carries its first round; after
            // that, rounds need an approved project to hang off.
            if (!created && project.status === "pending") {
              throw new ORPCError("BAD_REQUEST", {
                message: "This project is awaiting admin approval",
              });
            }
            if (!created && project.status === "rejected") {
              throw new ORPCError("BAD_REQUEST", {
                message: project.rejectionReason
                  ? `This project was rejected: ${project.rejectionReason}`
                  : "This project was rejected",
              });
            }

            const [counter] = await tx
              .insert(projectRoundCountersTable)
              .values({ projectSlug: project.slug, lastNumber: 1 })
              .onConflictDoUpdate({
                target: projectRoundCountersTable.projectSlug,
                set: { lastNumber: sql`${projectRoundCountersTable.lastNumber} + 1` },
              })
              .returning({ lastNumber: projectRoundCountersTable.lastNumber });

            const [inserted] = await tx
              .insert(roundsTable)
              .values({
                ownerAccountId: input.ownerAccountId,
                projectSlug: project.slug,
                projectId: input.projectId ?? project.nearbuildersProjectId,
                projectRecordId: project.id,
                projectRoundNumber: counter!.lastNumber,
                title: input.title,
                description: input.description,
                readme: input.readme ?? "",
                formats: input.formats,
                repoUrl: input.repoUrl ?? null,
                status: project.status === "approved" ? "open" : "pending",
              })
              .returning();

            return inserted;
          });

          if (!row) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create round" });
          }

          return toRoundRecord(row);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      updateRoundReadme: async (roundId, readme) => {
        try {
          const [updated] = await db
            .update(roundsTable)
            .set({ readme, updatedAt: new Date() })
            .where(eq(roundsTable.id, roundId))
            .returning();
          if (!updated) {
            throw new ORPCError("NOT_FOUND", { message: "Round not found" });
          }
          return toRoundRecord(updated);
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
          if (rows.length === 0) return [];
          const countRows = await db
            .select({ roundId: roundParticipantsTable.roundId, value: count() })
            .from(roundParticipantsTable)
            .where(
              inArray(
                roundParticipantsTable.roundId,
                rows.map((row) => row.id),
              ),
            )
            .groupBy(roundParticipantsTable.roundId);
          const counts = new Map(countRows.map((row) => [row.roundId, row.value]));
          return rows.map((row) => ({
            ...toRoundRecord(row),
            participantCount: counts.get(row.id) ?? 0,
          }));
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

      setFeedbackStatus: async (roundId, feedbackIds, status) => {
        try {
          if (feedbackIds.length === 0) return [];
          const rows = await db
            .update(roundFeedbackTable)
            .set({ status })
            .where(
              and(
                eq(roundFeedbackTable.roundId, roundId),
                inArray(roundFeedbackTable.id, feedbackIds),
              ),
            )
            .returning();
          return rows.map(toFeedbackRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listParticipants: async (roundId) => {
        try {
          const rows = await db
            .select({
              accountId: roundParticipantsTable.accountId,
              joinedAt: roundParticipantsTable.joinedAt,
            })
            .from(roundParticipantsTable)
            .where(eq(roundParticipantsTable.roundId, roundId))
            .orderBy(asc(roundParticipantsTable.joinedAt));
          return rows.map((row) => ({
            accountId: row.accountId,
            joinedAt:
              row.joinedAt instanceof Date ? row.joinedAt.toISOString() : String(row.joinedAt),
          }));
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

      listBuilderRounds: async (accountId) => {
        try {
          const rows = await db
            .select({
              roundId: roundCreditsTable.roundId,
              roundTitle: roundCreditsTable.roundTitle,
              projectSlug: roundCreditsTable.projectSlug,
              contributedMeaningfully: roundCreditsTable.contributedMeaningfully,
              summary: roundCreditsTable.summary,
              writtenCount: roundCreditsTable.writtenCount,
              recordedCount: roundCreditsTable.recordedCount,
              creditedAt: roundCreditsTable.createdAt,
              formats: roundsTable.formats,
              repoUrl: roundsTable.repoUrl,
              closedAt: roundsTable.closedAt,
            })
            .from(roundCreditsTable)
            .innerJoin(roundsTable, eq(roundsTable.id, roundCreditsTable.roundId))
            .where(
              and(
                eq(roundCreditsTable.builderAccountId, accountId),
                eq(roundsTable.status, "closed"),
              ),
            )
            .orderBy(desc(roundsTable.closedAt));

          return rows.map((row) => {
            const formats = row.formats as RoundFormat[];
            const closedAt =
              row.closedAt instanceof Date ? row.closedAt.toISOString() : String(row.closedAt);
            const creditedAt =
              row.creditedAt instanceof Date
                ? row.creditedAt.toISOString()
                : String(row.creditedAt);
            return {
              roundId: row.roundId,
              roundTitle: row.roundTitle,
              projectSlug: row.projectSlug,
              repoUrl: row.repoUrl,
              issuesUrl: toIssuesUrl(formats, row.repoUrl),
              contributedMeaningfully: row.contributedMeaningfully,
              summary: row.summary,
              writtenCount: row.writtenCount,
              recordedCount: row.recordedCount,
              closedAt,
              creditedAt,
            };
          });
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listMyJoinedRounds: async (accountId) => {
        try {
          const rows = await db
            .select({
              roundId: roundsTable.id,
              roundTitle: roundsTable.title,
              projectSlug: roundsTable.projectSlug,
              status: roundsTable.status,
              formats: roundsTable.formats,
              joinedAt: roundParticipantsTable.joinedAt,
            })
            .from(roundParticipantsTable)
            .innerJoin(roundsTable, eq(roundsTable.id, roundParticipantsTable.roundId))
            .where(eq(roundParticipantsTable.accountId, accountId))
            .orderBy(desc(roundParticipantsTable.joinedAt));
          if (rows.length === 0) return [];
          const countRows = await db
            .select({ roundId: roundParticipantsTable.roundId, value: count() })
            .from(roundParticipantsTable)
            .where(
              inArray(
                roundParticipantsTable.roundId,
                rows.map((row) => row.roundId),
              ),
            )
            .groupBy(roundParticipantsTable.roundId);
          const counts = new Map(countRows.map((row) => [row.roundId, row.value]));
          return rows.map((row) => ({
            roundId: row.roundId,
            roundTitle: row.roundTitle,
            projectSlug: row.projectSlug,
            status: row.status,
            formats: row.formats as RoundFormat[],
            participantCount: counts.get(row.roundId) ?? 0,
            joinedAt:
              row.joinedAt instanceof Date ? row.joinedAt.toISOString() : String(row.joinedAt),
          }));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listRoundActivityEventIds: async (roundIds) => {
        if (roundIds.length === 0) return {};
        try {
          const rows = await db
            .select({ id: roundsTable.id, activityEventId: roundsTable.activityEventId })
            .from(roundsTable)
            .where(and(inArray(roundsTable.id, roundIds), isNotNull(roundsTable.activityEventId)));
          const result: Record<string, string> = {};
          for (const row of rows) {
            if (row.activityEventId) result[row.id] = row.activityEventId;
          }
          return result;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setRoundActivityEventId: async (roundId, eventId) => {
        try {
          await db
            .update(roundsTable)
            .set({ activityEventId: eventId })
            .where(eq(roundsTable.id, roundId));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setFeedbackActivityEventId: async (feedbackId, eventId) => {
        try {
          await db
            .update(roundFeedbackTable)
            .set({ activityEventId: eventId })
            .where(eq(roundFeedbackTable.id, feedbackId));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setFeedbackNostrEventId: async (feedbackId, nostrEventId) => {
        try {
          await db
            .update(roundFeedbackTable)
            .set({ nostrEventId })
            .where(eq(roundFeedbackTable.id, feedbackId));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      deleteRound: async (roundId) => {
        try {
          const [row] = await db
            .delete(roundsTable)
            .where(eq(roundsTable.id, roundId))
            .returning({ activityEventId: roundsTable.activityEventId });
          return row ? { activityEventId: row.activityEventId } : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      deleteFeedback: async (feedbackId) => {
        try {
          const [row] = await db
            .delete(roundFeedbackTable)
            .where(eq(roundFeedbackTable.id, feedbackId))
            .returning({
              roundId: roundFeedbackTable.roundId,
              activityEventId: roundFeedbackTable.activityEventId,
            });
          return row ? { roundId: row.roundId, activityEventId: row.activityEventId } : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
