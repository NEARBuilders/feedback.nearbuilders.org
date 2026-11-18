import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import type { Database } from "@/db/layer";
import { DatabaseLive, DatabaseTag } from "@/db/layer";
import { projects as projectsTable } from "@/db/schema";
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

/** Same shape as the outbox harness: services and the raw db share one PGlite. */
function freshLayer() {
  const dir = mkdtempSync(join(tmpdir(), "api-grants-"));
  activeDir = dir;
  const dbLayer = DatabaseLive({
    pluginId: "api",
    secrets: { API_DATABASE_URL: `pglite:${dir}` },
  });
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
        const ctx = yield* Effect.context<DatabaseTag | RoundsTag | ProjectRecordsTag>();
        const db = Context.get(ctx, DatabaseTag);
        const rounds = Context.get(ctx, RoundsTag);
        const projects = Context.get(ctx, ProjectRecordsTag);
        return yield* Effect.promise(() => fn({ db, rounds, projects }));
      }).pipe(
        Effect.provide(
          layer as unknown as Layer.Layer<
            DatabaseTag | RoundsTag | ProjectRecordsTag,
            never,
            never
          >,
        ),
      ),
    ),
  );
}

async function seedProject(db: Database, slug: string, ownerOrgId: string | null): Promise<string> {
  const [row] = await db.insert(projectsTable).values({ slug, name: slug, ownerOrgId }).returning();
  return row!.id;
}

describe("access grants (#279)", () => {
  it("attaches grants to resolved projects, with the org slug snapshot", async () => {
    await withHarness(async ({ db, projects }) => {
      const id = await seedProject(db, "granted-project", "org-1");

      const record = await projects.resolveProjectById(id);
      expect(record?.accessGrants).toEqual([]);

      await projects.addAccessGrant(
        id,
        { principalType: "org", principalId: "org-2", permission: "manage", orgSlug: "nearlyops" },
        "owner.near",
      );

      const granted = await projects.resolveProjectById(id);
      expect(granted?.accessGrants).toEqual([
        {
          principalType: "org",
          principalId: "org-2",
          permission: "manage",
          orgSlug: "nearlyops",
          addedByAccountId: "owner.near",
          createdAt: expect.any(String),
        },
      ]);
      expect((await projects.resolveProjectBySlug("granted-project"))?.accessGrants).toHaveLength(
        1,
      );
    });
  });

  it("re-granting the same principal is idempotent", async () => {
    await withHarness(async ({ db, projects }) => {
      const id = await seedProject(db, "regrant", "org-1");
      const grant = {
        principalType: "org" as const,
        principalId: "org-2",
        permission: "manage" as const,
      };

      await projects.addAccessGrant(id, grant, "owner.near");
      const record = await projects.addAccessGrant(id, grant, "someone-else.near");

      expect(record?.accessGrants).toHaveLength(1);
      expect(record?.accessGrants[0]?.addedByAccountId).toBe("owner.near");
    });
  });

  it("withdraws a grant on removal", async () => {
    await withHarness(async ({ db, projects }) => {
      const id = await seedProject(db, "revoked", "org-1");
      await projects.addAccessGrant(
        id,
        { principalType: "org", principalId: "org-2", permission: "manage" },
        "owner.near",
      );

      const record = await projects.removeAccessGrant(id, "org", "org-2");
      expect(record?.accessGrants).toEqual([]);

      const other = await projects.removeAccessGrant(id, "org", "never-granted");
      expect(other?.accessGrants).toEqual([]);
    });
  });

  it("lists granted projects alongside owned ones on the org dashboard", async () => {
    await withHarness(async ({ db, projects }) => {
      const owned = await seedProject(db, "owned-project", "org-2");
      const granted = await seedProject(db, "granted-project", "org-1");
      const uninvolved = await seedProject(db, "other-project", "org-3");
      await projects.addAccessGrant(
        granted,
        { principalType: "org", principalId: "org-2", permission: "manage", orgSlug: "org-2" },
        "owner.near",
      );

      const mine = await projects.listProjectsByOrg("org-2");
      expect(mine.map((project) => project.id).sort()).toEqual([owned, granted].sort());
      expect(mine.find((project) => project.id === granted)?.accessGrants).toHaveLength(1);

      const theirs = await projects.listProjectsByOrg("org-3");
      expect(theirs.map((project) => project.id)).toEqual([uninvolved]);
    });
  });

  it("read-only grants do not put a project on the org dashboard", async () => {
    await withHarness(async ({ db, projects }) => {
      const id = await seedProject(db, "readable", "org-1");
      await projects.addAccessGrant(
        id,
        { principalType: "org", principalId: "org-2", permission: "read" },
        "owner.near",
      );
      expect(await projects.listProjectsByOrg("org-2")).toEqual([]);
    });
  });

  it("counts granted projects in the owner summary", async () => {
    await withHarness(async ({ rounds, projects }) => {
      const round = await rounds.createRound({
        ownerAccountId: "owner.near",
        ownerOrgId: "org-1",
        projectSlug: "summary-granted",
        title: "Partner round",
        description: "Co-managed",
        formats: ["written"],
      });
      await projects.addAccessGrant(
        round.projectRecordId,
        { principalType: "org", principalId: "org-2", permission: "manage" },
        "owner.near",
      );
      await projects.approveProject(round.projectRecordId);

      const summary = await rounds.getOwnerSummary("org-2");
      expect(summary.openRounds).toBe(1);
      expect(summary.pendingProjects).toBe(0);
      expect(await rounds.getOwnerSummary("org-1")).toEqual(summary);
    });
  });
});
