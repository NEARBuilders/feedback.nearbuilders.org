import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(import.meta.dirname, "../../src/db/migrations");
const BACKFILL_MIGRATION = "0013_project_anchor.sql";

async function applyMigration(db: PGlite, file: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) await db.exec(statement);
  }
}

async function dbBeforeBackfill() {
  const db = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && f < BACKFILL_MIGRATION)
    .sort();
  for (const file of files) await applyMigration(db, file);
  return db;
}

let counter = 0;
async function insertRound(
  db: PGlite,
  slug: string,
  status: "pending" | "open" | "closed" | "rejected",
  extra: { projectId?: string; reason?: string } = {},
) {
  counter += 1;
  await db.query(
    `INSERT INTO rounds (owner_account_id, project_slug, project_id, project_round_number, title, description, formats, status, rejected_at, rejection_reason)
     VALUES ($1, $2, $3, $4, 't', 'd', ARRAY['written'], $5::round_status, $6, $7)`,
    [
      "owner.near",
      slug,
      extra.projectId ?? null,
      counter,
      status,
      status === "rejected" ? new Date("2026-01-01T00:00:00Z") : null,
      extra.reason ?? null,
    ],
  );
}

describe("0013 project backfill", () => {
  it("creates one project per existing slug and links every round to it", async () => {
    const db = await dbBeforeBackfill();
    await insertRound(db, "live", "open", { projectId: "proj_1" });
    await insertRound(db, "live", "closed");
    await insertRound(db, "waiting", "pending");
    await insertRound(db, "declined", "rejected", { reason: "Repo is private" });

    await applyMigration(db, BACKFILL_MIGRATION);

    const projects = await db.query<{
      slug: string;
      name: string;
      status: string;
      owner_org_id: string | null;
      nearbuilders_project_id: string | null;
      rejection_reason: string | null;
      approved_at: Date | null;
    }>("SELECT * FROM projects ORDER BY slug");
    expect(projects.rows.map((p) => [p.slug, p.status])).toEqual([
      ["declined", "rejected"],
      ["live", "approved"],
      ["waiting", "pending"],
    ]);

    const bySlug = Object.fromEntries(projects.rows.map((p) => [p.slug, p]));
    expect(bySlug.live).toMatchObject({
      name: "live",
      owner_org_id: null,
      nearbuilders_project_id: "proj_1",
      rejection_reason: null,
    });
    expect(bySlug.live!.approved_at).not.toBeNull();
    expect(bySlug.declined!.rejection_reason).toBe("Repo is private");
    expect(bySlug.waiting!.approved_at).toBeNull();

    const orphans = await db.query(
      `SELECT r.id FROM rounds r LEFT JOIN projects p ON p.id = r.project_record_id WHERE p.slug IS DISTINCT FROM r.project_slug`,
    );
    expect(orphans.rows).toHaveLength(0);
  });

  it("keeps a project pending while any of its rounds still awaits review", async () => {
    const db = await dbBeforeBackfill();
    await insertRound(db, "mixed", "open");
    await insertRound(db, "mixed", "pending");

    await applyMigration(db, BACKFILL_MIGRATION);

    const { rows } = await db.query<{ status: string }>(
      "SELECT status FROM projects WHERE slug = 'mixed'",
    );
    expect(rows).toEqual([{ status: "pending" }]);
  });

  it("enforces slug uniqueness and requires a project on every round afterwards", async () => {
    const db = await dbBeforeBackfill();
    await applyMigration(db, BACKFILL_MIGRATION);

    await db.query("INSERT INTO projects (slug, name) VALUES ('dup', 'Dup')");
    await expect(
      db.query("INSERT INTO projects (slug, name) VALUES ('dup', 'Dup 2')"),
    ).rejects.toThrow();
    await expect(
      db.query(
        `INSERT INTO rounds (owner_account_id, project_slug, project_round_number, title, description, formats)
         VALUES ('o.near', 'dup', 1, 't', 'd', ARRAY['written'])`,
      ),
    ).rejects.toThrow();
  });
});
