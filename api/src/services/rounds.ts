import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { Transaction } from "../db";
import { DatabaseTag } from "../db/layer";
import {
  feedbackNotes as feedbackNotesTable,
  projectRoundCounters as projectRoundCountersTable,
  projects as projectsTable,
  roundCredits as roundCreditsTable,
  type roundFeedbackAuthorType,
  type roundFeedbackStatus,
  roundFeedback as roundFeedbackTable,
  roundParticipants as roundParticipantsTable,
  type roundStatus,
  rounds as roundsTable,
} from "../db/schema";
import { cancelPendingActivity, enqueueActivity, findEmittedEventId } from "./activity-outbox";
import { ensureProject } from "./project-records";

export type RoundStatus = (typeof roundStatus)["enumValues"][number];
export type RoundFormat = "issues" | "written" | "recorded";
export type RoundFeedbackFormat = "written" | "recorded";

export interface RoundParticipantRecord {
  accountId: string;
  joinedAt: string;
  feedbackCount: number;
}

export interface RoundSettingsPatch {
  readme?: string;
  formats?: RoundFormat[];
}
export type RoundFeedbackStatus = (typeof roundFeedbackStatus)["enumValues"][number];

export interface RoundRecord {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  /** The projects-table row this round belongs to (#69). */
  projectRecordId: string;
  projectRoundNumber: number;
  title: string;
  description: string;
  /** Markdown for testers: what to test and how (#71). Empty when the owner hasn't written one. */
  readme: string;
  formats: RoundFormat[];
  repoUrl: string | null;
  /** Feedback is readable only by the managing org/team, admins and its author (#101). */
  isPrivate: boolean;
  /** Only Legion SBT holders can join and post (#103). */
  legionOnly: boolean;
  /** Anyone can post feedback without joining or signing in, with no identity attached (#89). */
  allowAnonymous: boolean;
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
  isPrivate?: boolean;
  legionOnly?: boolean;
  allowAnonymous?: boolean;
}

export interface RoundSettingsInput {
  isPrivate?: boolean;
  legionOnly?: boolean;
}

export interface RoundDetailRecord extends RoundRecord {
  participantCount: number;
}

export interface RoundDetailWithSurfaceRecord extends RoundDetailRecord {
  /** First three participants, for the avatar row on a round's public surface. */
  participantPreview: string[];
  /** Number of submissions, shown even when the bodies are private. */
  feedbackCount: number;
}

export type RoundFeedbackAuthorType = (typeof roundFeedbackAuthorType)["enumValues"][number];

export interface RoundFeedbackRecord {
  id: string;
  roundId: string;
  /** Null for anonymous submissions (#89). */
  authorAccountId: string | null;
  authorType: RoundFeedbackAuthorType;
  format: RoundFeedbackFormat;
  body: string | null;
  url: string | null;
  status: RoundFeedbackStatus;
  /** Set when a round manager starred the submission (#104); independent of status. */
  starredAt: string | null;
  starredByAccountId: string | null;
  createdAt: string;
  activityEventId: string | null;
  nostrEventId: string | null;
}

export interface FeedbackNoteRecord {
  id: string;
  feedbackId: string;
  authorAccountId: string;
  role: "owner" | "tester";
  body: string;
  createdAt: string;
}

export type NewFeedbackNote = Pick<
  FeedbackNoteRecord,
  "feedbackId" | "authorAccountId" | "role" | "body"
>;

export interface FeedbackPageInput {
  cursor?: string;
  limit?: number;
  status?: RoundFeedbackStatus;
  author?: string;
  /** Any of these accounts: a user's linked NEAR accounts (#121). */
  authors?: string[];
  /** Only submissions a round manager starred (#104). */
  starred?: boolean;
}

export interface ProjectFeedbackQuery {
  roundNumber?: number;
  format?: RoundFeedbackFormat;
  authorType?: RoundFeedbackAuthorType;
  /** Only feedback created strictly after this moment: the polling cursor. */
  since?: Date;
  limit: number;
  /** Rounds whose feedback the caller may read in full. */
  readableRoundIds: string[];
  /** Rounds where the caller may only read their own submissions (private rounds). */
  ownRoundIds?: string[];
  /** The caller's own NEAR accounts, for `ownRoundIds`. */
  ownAuthors?: string[];
}

export interface ProjectFeedbackItem extends RoundFeedbackRecord {
  roundNumber: number;
  roundTitle: string;
  projectSlug: string;
}

export interface FeedbackPage {
  items: RoundFeedbackRecord[];
  nextCursor: string | null;
}

export const DEFAULT_FEEDBACK_PAGE_SIZE = 50;

export interface AddFeedbackInput {
  roundId: string;
  /** Null for an anonymous submission (#89). */
  authorAccountId: string | null;
  authorType?: RoundFeedbackAuthorType;
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
  projectRoundNumber: number;
  status: RoundStatus;
  formats: RoundFormat[];
  readme: string;
  repoUrl: string | null;
  participantCount: number;
  /** How many feedback items the caller has posted in this round. */
  myFeedbackCount: number;
  joinedAt: string;
}

/** Counts behind the owner's home-page overview; see `getOwnerSummary`. */
export interface OwnerSummary {
  openRounds: number;
  unresolvedFeedback: number;
  pendingProjects: number;
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
  updateRound(roundId: string, patch: RoundSettingsPatch): Promise<RoundRecord>;
  updateRoundSettings(roundId: string, settings: RoundSettingsInput): Promise<RoundRecord>;
  resolveRoundById(id: string): Promise<RoundRecord | null>;
  getRoundDetail(id: string): Promise<RoundDetailWithSurfaceRecord | null>;
  getRoundDetailBySlug(slug: string, number: number): Promise<RoundDetailWithSurfaceRecord | null>;
  listRounds(status?: RoundStatus): Promise<RoundDetailRecord[]>;
  addParticipant(roundId: string, accountId: string): Promise<void>;
  removeParticipant(roundId: string, accountId: string): Promise<void>;
  /** The first of `accountIds` that joined the round, or null when none did (#121). */
  findParticipantAccount(roundId: string, accountIds: string[]): Promise<string | null>;
  addFeedback(input: AddFeedbackInput): Promise<RoundFeedbackRecord>;
  listFeedback(roundId: string, page?: FeedbackPageInput): Promise<FeedbackPage>;
  getFeedback(roundId: string, feedbackId: string): Promise<RoundFeedbackRecord | null>;
  /**
   * Feedback across every round of a project, oldest first from `since`, with each item's
   * round context (#89). Callers decide which rounds they may read.
   */
  listProjectFeedback(
    projectRecordId: string,
    query: ProjectFeedbackQuery,
  ): Promise<ProjectFeedbackItem[]>;
  /** Every round of a project, whatever its status. */
  listRoundsByProject(projectRecordId: string): Promise<RoundRecord[]>;
  setFeedbackStatus(
    roundId: string,
    feedbackIds: string[],
    status: RoundFeedbackStatus,
    note?: Pick<FeedbackNoteRecord, "authorAccountId" | "body">,
  ): Promise<RoundFeedbackRecord[]>;
  /** Stars or unstars submissions, leaving their status untouched (#104). */
  setFeedbackStarred(
    roundId: string,
    feedbackIds: string[],
    starred: boolean,
    starredByAccountId: string,
  ): Promise<RoundFeedbackRecord[]>;
  addFeedbackNote(note: NewFeedbackNote): Promise<FeedbackNoteRecord>;
  listFeedbackNotes(feedbackIds: string[]): Promise<FeedbackNoteRecord[]>;
  listParticipants(roundId: string): Promise<RoundParticipantRecord[]>;
  getCreditCandidates(roundId: string): Promise<CreditCandidate[]>;
  closeRound(roundId: string, credits: CloseRoundCreditInput[]): Promise<RoundDetailRecord>;
  listRoundCredits(roundId: string): Promise<RoundCreditRecord[]>;
  listBuilderRounds(accountId: string): Promise<BuilderRoundRecord[]>;
  listMyJoinedRounds(accountIds: string[]): Promise<MyJoinedRoundRecord[]>;
  /** Counts for the owner's home-page summary: nothing here is scoped to one round. */
  getOwnerSummary(orgId: string): Promise<OwnerSummary>;
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
    projectRecordId: row.projectRecordId,
    projectRoundNumber: row.projectRoundNumber,
    title: row.title,
    description: row.description,
    readme: row.readme,
    formats: row.formats as RoundFormat[],
    repoUrl: row.repoUrl,
    isPrivate: row.isPrivate,
    legionOnly: row.legionOnly,
    allowAnonymous: row.allowAnonymous,
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
    authorType: row.authorType,
    format: row.format,
    body: row.body,
    url: row.url,
    status: row.status,
    starredAt: row.starredAt instanceof Date ? row.starredAt.toISOString() : null,
    starredByAccountId: row.starredByAccountId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    activityEventId: row.activityEventId,
    nostrEventId: row.nostrEventId,
  };
}

/**
 * Scopes an acceptance to the moment it happened, so re-accepting a previously
 * retracted item is a new event to the gateway rather than a deduped replay.
 */
function acceptanceKey(row: RoundFeedbackRow): string {
  const at =
    row.statusChangedAt instanceof Date
      ? row.statusChangedAt.toISOString()
      : String(row.statusChangedAt);
  return `feedback.accepted:${row.id}:${at}`;
}

/**
 * Queue the reputation events for feedback that crossed the accepted boundary.
 *
 * activity scores `feedback.accepted`, so both directions matter: accepting
 * enqueues an emit, un-accepting cancels that emit if it is still queued and
 * otherwise retracts the delivered event.
 */
async function queueAcceptanceEvents(
  tx: Transaction,
  roundId: string,
  before: RoundFeedbackRow[],
  after: RoundFeedbackRow[],
): Promise<void> {
  const previous = new Map(before.map((row) => [row.id, row]));

  for (const row of after) {
    const prior = previous.get(row.id);
    if (!prior) continue;

    const wasAccepted = prior.status === "resolved";
    const isAccepted = row.status === "resolved";
    if (wasAccepted === isAccepted) continue;

    if (isAccepted) {
      // Anonymous feedback has no one to credit (#89).
      if (!row.authorAccountId) continue;
      await enqueueActivity(tx, {
        operation: "emit",
        eventType: "feedback.accepted",
        actor: row.authorAccountId,
        idempotencyKey: acceptanceKey(row),
        // Never the body: private rounds must not leak through activity (#101).
        payload: { feedbackId: row.id, roundId, format: row.format },
        subjectKind: "feedback_accepted",
        subjectId: row.id,
      });
      continue;
    }

    const cancelled = await cancelPendingActivity(tx, acceptanceKey(prior));
    const deliveredEventId =
      prior.acceptedActivityEventId ?? (await findEmittedEventId(tx, acceptanceKey(prior)));
    if (!cancelled && deliveredEventId) {
      await enqueueActivity(tx, {
        operation: "retract",
        idempotencyKey: `retract:${deliveredEventId}`,
        targetEventId: deliveredEventId,
        reason: "feedback no longer accepted",
      });
    }
    await tx
      .update(roundFeedbackTable)
      .set({ acceptedActivityEventId: null })
      .where(eq(roundFeedbackTable.id, row.id));
  }
}

type RoundCreditRow = typeof roundCreditsTable.$inferSelect;

function toNoteRecord(row: typeof feedbackNotesTable.$inferSelect): FeedbackNoteRecord {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

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

    const findRoundDetail = async (where: SQL | undefined) => {
      try {
        const [row] = await db.select().from(roundsTable).where(where).limit(1);
        if (!row) return null;
        const [countRow] = await db
          .select({ value: count() })
          .from(roundParticipantsTable)
          .where(eq(roundParticipantsTable.roundId, row.id));
        const previewRows = await db
          .select({ accountId: roundParticipantsTable.accountId })
          .from(roundParticipantsTable)
          .where(eq(roundParticipantsTable.roundId, row.id))
          .orderBy(asc(roundParticipantsTable.joinedAt))
          .limit(3);
        const [feedbackRow] = await db
          .select({ value: count() })
          .from(roundFeedbackTable)
          .where(eq(roundFeedbackTable.roundId, row.id));
        return {
          ...toRoundRecord(row),
          participantCount: countRow?.value ?? 0,
          participantPreview: previewRows.map((p) => p.accountId),
          feedbackCount: feedbackRow?.value ?? 0,
        };
      } catch (error) {
        throw toOrpcError(error);
      }
    };

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
                projectRecordId: project.id,
                projectRoundNumber: counter!.lastNumber,
                title: input.title,
                description: input.description,
                readme: input.readme ?? "",
                formats: input.formats,
                repoUrl: input.repoUrl ?? null,
                isPrivate: input.isPrivate ?? false,
                legionOnly: input.legionOnly ?? false,
                allowAnonymous: input.allowAnonymous ?? false,
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

      updateRound: async (roundId, patch) => {
        try {
          const [updated] = await db
            .update(roundsTable)
            .set({ ...patch, updatedAt: new Date() })
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

      updateRoundSettings: async (roundId, settings) => {
        try {
          const [updated] = await db
            .update(roundsTable)
            .set({
              ...(settings.isPrivate !== undefined ? { isPrivate: settings.isPrivate } : {}),
              ...(settings.legionOnly !== undefined ? { legionOnly: settings.legionOnly } : {}),
              updatedAt: new Date(),
            })
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

      getRoundDetail: (id) => findRoundDetail(eq(roundsTable.id, id)),

      getRoundDetailBySlug: (slug, number) =>
        findRoundDetail(
          and(eq(roundsTable.projectSlug, slug), eq(roundsTable.projectRoundNumber, number)),
        ),

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

      findParticipantAccount: async (roundId, accountIds) => {
        if (accountIds.length === 0) return null;
        try {
          const rows = await db
            .select({ accountId: roundParticipantsTable.accountId })
            .from(roundParticipantsTable)
            .where(
              and(
                eq(roundParticipantsTable.roundId, roundId),
                inArray(roundParticipantsTable.accountId, accountIds),
              ),
            );
          const joined = new Set(rows.map((row) => row.accountId));
          return accountIds.find((id) => joined.has(id)) ?? null;
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
              authorType: input.authorType ?? "near",
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

      listRoundsByProject: async (projectRecordId) => {
        try {
          const rows = await db
            .select()
            .from(roundsTable)
            .where(eq(roundsTable.projectRecordId, projectRecordId))
            .orderBy(asc(roundsTable.projectRoundNumber));
          return rows.map(toRoundRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listProjectFeedback: async (projectRecordId, query) => {
        try {
          const ownRoundIds = query.ownRoundIds ?? [];
          const ownAuthors = query.ownAuthors ?? [];
          const readable = [
            query.readableRoundIds.length > 0
              ? inArray(roundFeedbackTable.roundId, query.readableRoundIds)
              : undefined,
            ownRoundIds.length > 0 && ownAuthors.length > 0
              ? and(
                  inArray(roundFeedbackTable.roundId, ownRoundIds),
                  inArray(roundFeedbackTable.authorAccountId, ownAuthors),
                )
              : undefined,
          ].filter((condition): condition is SQL => !!condition);
          if (readable.length === 0) return [];
          const rows = await db
            .select({
              feedback: getTableColumns(roundFeedbackTable),
              roundNumber: roundsTable.projectRoundNumber,
              roundTitle: roundsTable.title,
              projectSlug: roundsTable.projectSlug,
            })
            .from(roundFeedbackTable)
            .innerJoin(roundsTable, eq(roundsTable.id, roundFeedbackTable.roundId))
            .where(
              and(
                eq(roundsTable.projectRecordId, projectRecordId),
                or(...readable),
                query.roundNumber !== undefined
                  ? eq(roundsTable.projectRoundNumber, query.roundNumber)
                  : undefined,
                query.format ? eq(roundFeedbackTable.format, query.format) : undefined,
                query.authorType ? eq(roundFeedbackTable.authorType, query.authorType) : undefined,
                query.since
                  ? sql`${roundFeedbackTable.createdAt} > ${query.since.toISOString()}::timestamptz`
                  : undefined,
              ),
            )
            .orderBy(asc(roundFeedbackTable.createdAt), asc(roundFeedbackTable.id))
            .limit(query.limit);
          return rows.map((row) => ({
            ...toFeedbackRecord(row.feedback as RoundFeedbackRow),
            roundNumber: row.roundNumber,
            roundTitle: row.roundTitle,
            projectSlug: row.projectSlug,
          }));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listFeedback: async (roundId, page = {}) => {
        try {
          const limit = page.limit ?? DEFAULT_FEEDBACK_PAGE_SIZE;
          const [cursorAt, cursorId] = page.cursor?.split("|") ?? [];
          const afterCursor =
            cursorAt && cursorId
              ? sql`(${roundFeedbackTable.createdAt}, ${roundFeedbackTable.id}) < (${cursorAt}::timestamptz, ${cursorId}::uuid)`
              : undefined;
          const rows = await db
            .select({
              ...getTableColumns(roundFeedbackTable),
              cursor: sql<string>`${roundFeedbackTable.createdAt}::text || '|' || ${roundFeedbackTable.id}`,
            })
            .from(roundFeedbackTable)
            .where(
              and(
                eq(roundFeedbackTable.roundId, roundId),
                page.status ? eq(roundFeedbackTable.status, page.status) : undefined,
                page.starred ? isNotNull(roundFeedbackTable.starredAt) : undefined,
                page.authors?.length
                  ? inArray(roundFeedbackTable.authorAccountId, page.authors)
                  : page.author
                    ? eq(roundFeedbackTable.authorAccountId, page.author)
                    : undefined,
                afterCursor,
              ),
            )
            .orderBy(desc(roundFeedbackTable.createdAt), desc(roundFeedbackTable.id))
            .limit(limit + 1);
          const pageRows = rows.slice(0, limit);
          return {
            items: pageRows.map(toFeedbackRecord),
            nextCursor: rows.length > limit ? (pageRows.at(-1)?.cursor ?? null) : null,
          };
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      getFeedback: async (roundId, feedbackId) => {
        try {
          const [row] = await db
            .select()
            .from(roundFeedbackTable)
            .where(
              and(eq(roundFeedbackTable.roundId, roundId), eq(roundFeedbackTable.id, feedbackId)),
            )
            .limit(1);
          return row ? toFeedbackRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setFeedbackStatus: async (roundId, feedbackIds, status, note) => {
        try {
          if (feedbackIds.length === 0) return [];
          return await db.transaction(async (tx) => {
            // Read first so the activity intents below can tell which items
            // crossed the accepted boundary, which `.returning()` alone can't.
            const before = await tx
              .select()
              .from(roundFeedbackTable)
              .where(
                and(
                  eq(roundFeedbackTable.roundId, roundId),
                  inArray(roundFeedbackTable.id, feedbackIds),
                  ne(roundFeedbackTable.status, status),
                ),
              );
            if (before.length === 0) return [];

            const rows = await tx
              .update(roundFeedbackTable)
              .set({ status, statusChangedAt: sql`now()` })
              .where(
                inArray(
                  roundFeedbackTable.id,
                  before.map((row) => row.id),
                ),
              )
              .returning();
            if (note && rows.length > 0) {
              await tx
                .insert(feedbackNotesTable)
                .values(
                  rows.map((row) => ({ ...note, feedbackId: row.id, role: "owner" as const })),
                );
            }

            await queueAcceptanceEvents(tx, roundId, before, rows);

            return rows.map(toFeedbackRecord);
          });
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      addFeedbackNote: async (note) => {
        try {
          const [row] = await db.insert(feedbackNotesTable).values(note).returning();
          if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Note not saved" });
          return toNoteRecord(row);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listFeedbackNotes: async (feedbackIds) => {
        try {
          if (feedbackIds.length === 0) return [];
          const rows = await db
            .select()
            .from(feedbackNotesTable)
            .where(inArray(feedbackNotesTable.feedbackId, feedbackIds))
            .orderBy(asc(feedbackNotesTable.createdAt));
          return rows.map(toNoteRecord);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setFeedbackStarred: async (roundId, feedbackIds, starred, starredByAccountId) => {
        try {
          if (feedbackIds.length === 0) return [];
          const rows = await db
            .update(roundFeedbackTable)
            .set(
              starred
                ? { starredAt: new Date(), starredByAccountId }
                : { starredAt: null, starredByAccountId: null },
            )
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
              feedbackCount: count(roundFeedbackTable.id),
            })
            .from(roundParticipantsTable)
            .leftJoin(
              roundFeedbackTable,
              and(
                eq(roundFeedbackTable.roundId, roundParticipantsTable.roundId),
                eq(roundFeedbackTable.authorAccountId, roundParticipantsTable.accountId),
              ),
            )
            .where(eq(roundParticipantsTable.roundId, roundId))
            .groupBy(roundParticipantsTable.accountId, roundParticipantsTable.joinedAt)
            .orderBy(asc(roundParticipantsTable.joinedAt));
          return rows.map((row) => ({
            ...row,
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
            // Anonymous feedback (#89) has no one to credit.
            if (!row.accountId) continue;
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
              if (!row.accountId) continue;
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

      listMyJoinedRounds: async (accountIds) => {
        if (accountIds.length === 0) return [];
        try {
          const rows = await db
            .select({
              roundId: roundsTable.id,
              roundTitle: roundsTable.title,
              projectSlug: roundsTable.projectSlug,
              projectRoundNumber: roundsTable.projectRoundNumber,
              status: roundsTable.status,
              formats: roundsTable.formats,
              readme: roundsTable.readme,
              repoUrl: roundsTable.repoUrl,
              joinedAt: roundParticipantsTable.joinedAt,
            })
            .from(roundParticipantsTable)
            .innerJoin(roundsTable, eq(roundsTable.id, roundParticipantsTable.roundId))
            .where(inArray(roundParticipantsTable.accountId, accountIds))
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
          const feedbackRows = await db
            .select({ roundId: roundFeedbackTable.roundId, value: count() })
            .from(roundFeedbackTable)
            .where(
              and(
                inArray(roundFeedbackTable.authorAccountId, accountIds),
                inArray(
                  roundFeedbackTable.roundId,
                  rows.map((row) => row.roundId),
                ),
              ),
            )
            .groupBy(roundFeedbackTable.roundId);
          const feedbackCounts = new Map(feedbackRows.map((row) => [row.roundId, row.value]));
          return rows.map((row) => ({
            roundId: row.roundId,
            roundTitle: row.roundTitle,
            projectSlug: row.projectSlug,
            projectRoundNumber: row.projectRoundNumber,
            status: row.status,
            formats: row.formats as RoundFormat[],
            readme: row.readme,
            repoUrl: row.repoUrl,
            participantCount: counts.get(row.roundId) ?? 0,
            myFeedbackCount: feedbackCounts.get(row.roundId) ?? 0,
            joinedAt:
              row.joinedAt instanceof Date ? row.joinedAt.toISOString() : String(row.joinedAt),
          }));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      getOwnerSummary: async (orgId) => {
        try {
          // One grouped query: without the distinct-filter count, the round
          // and feedback joins would multiply each other's rows.
          const [row] = await db
            .select({
              openRounds: sql<number>`count(distinct ${roundsTable.id}) filter (where ${roundsTable.status} = 'open')::int`,
              unresolvedFeedback: sql<number>`count(distinct ${roundFeedbackTable.id}) filter (where ${roundFeedbackTable.status} = 'unresolved')::int`,
              pendingProjects: sql<number>`count(distinct ${projectsTable.id}) filter (where ${projectsTable.status} = 'pending')::int`,
            })
            .from(projectsTable)
            .leftJoin(roundsTable, eq(roundsTable.projectRecordId, projectsTable.id))
            .leftJoin(roundFeedbackTable, eq(roundFeedbackTable.roundId, roundsTable.id))
            .where(eq(projectsTable.ownerOrgId, orgId));
          return {
            openRounds: row?.openRounds ?? 0,
            unresolvedFeedback: row?.unresolvedFeedback ?? 0,
            pendingProjects: row?.pendingProjects ?? 0,
          };
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
