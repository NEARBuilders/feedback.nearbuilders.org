import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import type { Database } from "../db/layer";
import { DatabaseTag } from "../db/layer";
import {
  accessGrants as accessGrantsTable,
  type projectStatus,
  projects as projectsTable,
  type roundStatus,
  rounds as roundsTable,
} from "../db/schema";
import type { AccessGrantSubject } from "./round-access";

export type ProjectStatus = (typeof projectStatus)["enumValues"][number];

export interface ProjectAccessGrant extends AccessGrantSubject {
  /** Display snapshot for org principals, so the UI never needs live org lookups. */
  orgSlug: string | null;
  addedByAccountId: string;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  slug: string;
  name: string;
  /** Null only for projects backfilled from rounds that predate org ownership. */
  ownerOrgId: string | null;
  /** Team the owning org delegated round management to; null means any org member. */
  managingTeamId: string | null;
  /**
   * Principals granted management beyond the owner (#279). Attached by the
   * resolve/list loaders; rows built inside the create-round transaction carry
   * none, and nothing in that flow consults grants — partners manage existing
   * rounds, they never create rounds under someone else's project.
   */
  accessGrants: ProjectAccessGrant[];
  nearbuildersProjectId: string | null;
  /** Contact the requester volunteered on the round form (telegram/email/URL). */
  contact: string | null;
  status: ProjectStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  /** Admin-toggled diligence mark, independent of approval. */
  verifiedAt: string | null;
  verifiedByAccountId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRoundSummary {
  id: string;
  ownerAccountId: string;
  title: string;
  status: (typeof roundStatus)["enumValues"][number];
  projectRoundNumber: number;
  endsAt: string | null;
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
  /**
   * Grants a principal management of the project's rounds (#279). Idempotent;
   * v1 writes org principals with the "manage" permission.
   */
  addAccessGrant(
    projectId: string,
    grant: {
      principalType: "org" | "team";
      principalId: string;
      permission: "manage" | "read";
      orgSlug?: string | null;
    },
    addedByAccountId: string,
  ): Promise<ProjectRecord | null>;
  /** Withdraws a grant; null when the project itself is gone. */
  removeAccessGrant(
    projectId: string,
    principalType: "org" | "team",
    principalId: string,
  ): Promise<ProjectRecord | null>;
  getProjectWithRounds(id: string): Promise<ProjectWithRounds | null>;
  listProjects(status?: ProjectStatus): Promise<ProjectWithRounds[]>;
  /** Projects the org owns or has been granted management of (#279). */
  listProjectsByOrg(orgId: string): Promise<ProjectWithRounds[]>;
  /** Pending -> approved, opening the project's pending rounds. Throws BAD_REQUEST otherwise. */
  approveProject(id: string): Promise<ProjectDecisionResult>;
  /** Pending -> rejected with a reason, rejecting the project's pending rounds with it. */
  rejectProject(id: string, reason: string): Promise<ProjectDecisionResult>;
  /** Sets the admin-toggled verified mark on any non-rejected project. */
  verifyProject(id: string, verifiedByAccountId: string | null): Promise<ProjectRecord | null>;
  /** Clears the verified mark. */
  unverifyProject(id: string): Promise<ProjectRecord | null>;
}

export class ProjectRecordsTag extends Context.Service<ProjectRecordsTag, ProjectRecordsService>()(
  "api/ProjectRecords",
) {}

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
    accessGrants: [],
    nearbuildersProjectId: row.nearbuildersProjectId,
    contact: row.contact,
    status: row.status,
    approvedAt: iso(row.approvedAt),
    rejectedAt: iso(row.rejectedAt),
    rejectionReason: row.rejectionReason,
    verifiedAt: iso(row.verifiedAt),
    verifiedByAccountId: row.verifiedByAccountId,
    createdAt: iso(row.createdAt) ?? "",
    updatedAt: iso(row.updatedAt) ?? "",
  };
}

/**
 * Attaches each project's access grants in one batched query. This is the seam
 * where grants enter the access decision: if the source ever moves to a
 * canonical NearBuilders API, only this function changes.
 */
async function attachGrants<T extends ProjectRecord>(db: Database, records: T[]): Promise<T[]> {
  if (records.length === 0) return records;
  const rows = await db
    .select()
    .from(accessGrantsTable)
    .where(
      inArray(
        accessGrantsTable.projectId,
        records.map((record) => record.id),
      ),
    );
  const byProject = new Map<string, ProjectAccessGrant[]>();
  for (const row of rows) {
    const grant: ProjectAccessGrant = {
      principalType: row.principalType,
      principalId: row.principalId,
      permission: row.permission,
      orgSlug: row.orgSlug,
      addedByAccountId: row.addedByAccountId,
      createdAt: iso(row.createdAt) ?? "",
    };
    const existing = byProject.get(row.projectId);
    if (existing) existing.push(grant);
    else byProject.set(row.projectId, [grant]);
  }
  return records.map((record) => ({
    ...record,
    accessGrants: byProject.get(record.id) ?? [],
  }));
}

/** Grants principal filter shared by the "owned or granted" org queries (#279). */
export function grantedProjectIds(db: Database, orgId: string) {
  return db
    .select({ projectId: accessGrantsTable.projectId })
    .from(accessGrantsTable)
    .where(
      and(
        eq(accessGrantsTable.principalType, "org"),
        eq(accessGrantsTable.principalId, orgId),
        eq(accessGrantsTable.permission, "manage"),
      ),
    );
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
  /** Contact volunteered on the round request form, stored for admin diligence. */
  contact?: string | null;
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
      contact: input.contact?.trim() || null,
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
        ...(input.contact?.trim() ? { contact: input.contact.trim() } : {}),
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
  if (input.contact?.trim() && input.contact.trim() !== existing.contact) {
    const [updated] = await tx
      .update(projectsTable)
      .set({ contact: input.contact.trim(), updatedAt: new Date() })
      .where(eq(projectsTable.id, existing.id))
      .returning();
    return { project: toProjectRecord(updated ?? existing), created: false };
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
      endsAt: roundsTable.endsAt,
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
      .map(({ projectRecordId: _projectRecordId, endsAt, ...round }) => ({
        ...round,
        endsAt: endsAt instanceof Date ? endsAt.toISOString() : null,
      })),
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
          if (!row) return null;
          const [record] = await attachGrants(db, [toProjectRecord(row)]);
          return record ?? null;
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
          if (!row) return null;
          const [record] = await attachGrants(db, [toProjectRecord(row)]);
          return record ?? null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      addAccessGrant: async (projectId, grant, addedByAccountId) => {
        try {
          await db
            .insert(accessGrantsTable)
            .values({
              projectId,
              principalType: grant.principalType,
              principalId: grant.principalId,
              permission: grant.permission,
              orgSlug: grant.orgSlug ?? null,
              addedByAccountId,
            })
            .onConflictDoNothing({
              target: [
                accessGrantsTable.projectId,
                accessGrantsTable.principalType,
                accessGrantsTable.principalId,
              ],
            });
          const [row] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.id, projectId))
            .limit(1);
          if (!row) return null;
          const [record] = await attachGrants(db, [toProjectRecord(row)]);
          return record ?? null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      removeAccessGrant: async (projectId, principalType, principalId) => {
        try {
          await db
            .delete(accessGrantsTable)
            .where(
              and(
                eq(accessGrantsTable.projectId, projectId),
                eq(accessGrantsTable.principalType, principalType),
                eq(accessGrantsTable.principalId, principalId),
              ),
            );
          const [row] = await db
            .select()
            .from(projectsTable)
            .where(eq(projectsTable.id, projectId))
            .limit(1);
          if (!row) return null;
          const [record] = await attachGrants(db, [toProjectRecord(row)]);
          return record ?? null;
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
          if (!row) return null;
          const [record] = await attachGrants(db, [toProjectRecord(row)]);
          return record ?? null;
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
          if (!withRoundsRow) return null;
          const [granted] = await attachGrants(db, [withRoundsRow]);
          return granted ?? null;
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
          return await attachGrants(db, await withRounds(db, rows));
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      listProjectsByOrg: async (orgId) => {
        try {
          const rows = await db
            .select()
            .from(projectsTable)
            .where(
              or(
                eq(projectsTable.ownerOrgId, orgId),
                inArray(projectsTable.id, grantedProjectIds(db, orgId)),
              ),
            )
            .orderBy(desc(projectsTable.createdAt));
          return await attachGrants(db, await withRounds(db, rows));
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

      verifyProject: async (id, verifiedByAccountId) => {
        try {
          const [row] = await db
            .update(projectsTable)
            .set({
              verifiedAt: new Date(),
              verifiedByAccountId,
              updatedAt: new Date(),
            })
            .where(and(eq(projectsTable.id, id), ne(projectsTable.status, "rejected")))
            .returning();
          return row ? toProjectRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },

      unverifyProject: async (id) => {
        try {
          const [row] = await db
            .update(projectsTable)
            .set({ verifiedAt: null, verifiedByAccountId: null, updatedAt: new Date() })
            .where(eq(projectsTable.id, id))
            .returning();
          return row ? toProjectRecord(row) : null;
        } catch (error) {
          throw toOrpcError(error);
        }
      },
    };

    return service;
  }),
);
