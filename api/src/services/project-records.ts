import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import type { Database } from "../db";
import { DatabaseTag } from "../db/layer";
import {
  type projectStatus,
  projects as projectsTable,
  type roundStatus,
  rounds as roundsTable,
} from "../db/schema";

export type ProjectStatus = (typeof projectStatus)["enumValues"][number];

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  /** Null only for projects backfilled from rounds that predate org ownership. */
  ownerOrgId: string | null;
  /** Team the owning org delegated round management to; null means any org member. */
  managingTeamId: string | null;
  nearbuildersProjectId: string | null;
  status: ProjectStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRoundSummary {
  id: string;
  ownerAccountId: string;
  title: string;
  status: (typeof roundStatus)["enumValues"][number];
  projectRoundNumber: number;
}

export interface ProjectWithRounds extends ProjectRecord {
  rounds: ProjectRoundSummary[];
}

export interface ProjectDecisionResult {
  project: ProjectRecord;
  /** Rounds that were waiting on this decision and moved with it. */
  decidedRoundIds: string[];
}

export interface ProjectRecordsService {
  resolveProjectById(id: string): Promise<ProjectRecord | null>;
  resolveProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  /** Delegates round management to a team, or back to every org member with null. */
  setManagingTeam(id: string, teamId: string | null): Promise<ProjectRecord | null>;
  getProjectWithRounds(id: string): Promise<ProjectWithRounds | null>;
  listProjects(status?: ProjectStatus): Promise<ProjectWithRounds[]>;
  listProjectsByOrg(orgId: string): Promise<ProjectWithRounds[]>;
  /** Pending -> approved, opening the project's pending rounds. Throws BAD_REQUEST otherwise. */
  approveProject(id: string): Promise<ProjectDecisionResult>;
  /** Pending -> rejected with a reason, rejecting the project's pending rounds with it. */
  rejectProject(id: string, reason: string): Promise<ProjectDecisionResult>;
}

export class ProjectRecordsTag extends Context.Tag("api/ProjectRecords")<
  ProjectRecordsService,
  ProjectRecordsService
>() {}

type ProjectRow = typeof projectsTable.$inferSelect;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function toProjectRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    ownerOrgId: row.ownerOrgId,
    managingTeamId: row.managingTeamId,
    nearbuildersProjectId: row.nearbuildersProjectId,
    status: row.status,
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    rejectionReason: row.rejectionReason,
    createdAt: iso(row.createdAt) ?? "",
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

function toOrpcError(error: unknown): ORPCError<string, unknown> {
  return error instanceof ORPCError
    ? error
    : new ORPCError("INTERNAL_SERVER_ERROR", {
        message: error instanceof Error ? error.message : String(error),
      });
}

export interface EnsureProjectInput {
  slug: string;
  name: string;
  ownerOrgId: string;
  /** The requesting builder; lets them claim a legacy project they already own rounds in. */
  requesterAccountId: string;
  nearbuildersProjectId?: string | null;
}

/**
 * Finds the project for `slug`, or creates it as `pending` owned by the
 * requester's org. For an existing project, enforces that the requester's org
 * owns it. Must run inside the transaction that creates the round, so a failed
 * round never leaves an empty project behind in the approval queue.
 */
export async function ensureProject(
  tx: Transaction,
  input: EnsureProjectInput,
): Promise<{ project: ProjectRecord; created: boolean }> {
  const [inserted] = await tx
    .insert(projectsTable)
    .values({
      slug: input.slug,
      name: input.name,
      ownerOrgId: input.ownerOrgId,
      nearbuildersProjectId: input.nearbuildersProjectId ?? null,
    })
    .onConflictDoNothing({ target: projectsTable.slug })
    .returning();
  if (inserted) return { project: toProjectRecord(inserted), created: true };

  const [existing] = await tx
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.slug, input.slug))
    .limit(1);
  if (!existing) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to resolve project" });
  }

  if (existing.ownerOrgId === null) {
    const [ownRound] = await tx
      .select({ id: roundsTable.id })
      .from(roundsTable)
      .where(
        and(
          eq(roundsTable.projectRecordId, existing.id),
          eq(roundsTable.ownerAccountId, input.requesterAccountId),
        ),
      )
      .limit(1);
    if (!ownRound) {
      throw new ORPCError("FORBIDDEN", {
        message: "This project belongs to another organization",
      });
    }
    const [claimed] = await tx
      .update(projectsTable)
      .set({
        ownerOrgId: input.ownerOrgId,
        nearbuildersProjectId:
          existing.nearbuildersProjectId ?? input.nearbuildersProjectId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projectsTable.id, existing.id))
      .returning();
    return { project: toProjectRecord(claimed ?? existing), created: false };
  }

  if (existing.ownerOrgId !== input.ownerOrgId) {
    throw new ORPCError("FORBIDDEN", {
      message: "This project belongs to another organization",
    });
  }
  return { project: toProjectRecord(existing), created: false };
}

async function withRounds(db: Database, rows: ProjectRow[]): Promise<ProjectWithRounds[]> {
  if (rows.length === 0) return [];
  const roundRows = await db
    .select({
      id: roundsTable.id,
      ownerAccountId: roundsTable.ownerAccountId,
      title: roundsTable.title,
      status: roundsTable.status,
      projectRoundNumber: roundsTable.projectRoundNumber,
      projectRecordId: roundsTable.projectRecordId,
    })
    .from(roundsTable)
    .where(
      inArray(
        roundsTable.projectRecordId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(roundsTable.projectRoundNumber));
  return rows.map((row) => ({
    ...toProjectRecord(row),
    rounds: roundRows
      .filter((r) => r.projectRecordId === row.id)
      .map(({ projectRecordId: _projectRecordId, ...round }) => round),
  }));
}

export const ProjectRecordsLive = Layer.effect(
  ProjectRecordsTag,
  Effect.gen(function* () {
    const db = yield* DatabaseTag;

    const decide = (
      id: string,
      verb: "approved" | "rejected",
      changes: Partial<typeof projectsTable.$inferInsert>,
      roundChanges: Partial<typeof roundsTable.$inferInsert>,
    ) =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(projectsTable)
          .where(eq(projectsTable.id, id))
          .limit(1);
        if (!row) throw new ORPCError("NOT_FOUND", { message: "Project not found" });
        if (row.status !== "pending") {
          throw new ORPCError("BAD_REQUEST", {
            message: `Only pending projects can be ${verb}`,
          });
        }
        const now = new Date();
        const [updated] = await tx
          .update(projectsTable)
          .set({ ...changes, updatedAt: now })
          .where(eq(projectsTable.id, id))
          .returning();
        const decided = await tx
          .update(roundsTable)
          .set({ ...roundChanges, updatedAt: now })
          .where(and(eq(roundsTable.projectRecordId, id), eq(roundsTable.status, "pending")))
          .returning({ id: roundsTable.id });
        return {
          project: toProjectRecord(updated!),
          decidedRoundIds: decided.map((r) => r.id),
        };
      });

    const service: ProjectRecordsService = {
      resolveProjectById: async (id) => {
        try {
          const [row] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.id, id))
            .limit(1);
          return row ? toProjectRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      setManagingTeam: async (id, teamId) => {
        try {
          const [row] = await db
            .update(projectsTable)
            .set({ managingTeamId: teamId, updatedAt: new Date() })
            .where(eq(projectsTable.id, id))
            .returning();
          return row ? toProjectRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      resolveProjectBySlug: async (slug) => {
        try {
          const [row] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.slug, slug))
            .limit(1);
          return row ? toProjectRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      getProjectWithRounds: async (id) => {
        try {
          const [row] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.id, id))
            .limit(1);
          if (!row) return null;
          const [withRoundsRow] = await withRounds(db, [row]);
          return withRoundsRow ?? null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listProjects: async (status) => {
        try {
          const rows = await db
            .select()
            .from(projectsTable)
            .where(status ? eq(projectsTable.status, status) : undefined)
            .orderBy(desc(projectsTable.createdAt));
          return await withRounds(db, rows);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listProjectsByOrg: async (orgId) => {
        try {
          const rows = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.ownerOrgId, orgId))
            .orderBy(desc(projectsTable.createdAt));
          return await withRounds(db, rows);
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      approveProject: async (id) => {
        try {
          const now = new Date();
          return await decide(
            id,
            "approved",
            { status: "approved", approvedAt: now, rejectedAt: null, rejectionReason: null },
            { status: "open" },
          );
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      rejectProject: async (id, reason) => {
        try {
          const now = new Date();
          return await decide(
            id,
            "rejected",
            { status: "rejected", rejectedAt: now, rejectionReason: reason },
            { status: "rejected", rejectedAt: now, rejectionReason: reason },
          );
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
