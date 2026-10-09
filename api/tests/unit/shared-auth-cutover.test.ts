import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { executePlan, loadAuthSnapshot, loadProjectRefs } from "../../scripts/shared-auth/db";
import { planRemap } from "../../scripts/shared-auth/plan";
import { checkAuthSchema } from "../../scripts/shared-auth/schema-check";
import { canManageRound, needsTeamCheck, type RoundActor } from "../../src/services/round-access";

// Copied verbatim from NEARBuilders/everything-dev plugins/auth/src/db/migrations.
const AUTH_MIGRATIONS_DIR = join(import.meta.dirname, "../fixtures/auth-migrations");
const API_MIGRATIONS_DIR = join(import.meta.dirname, "../../src/db/migrations");

async function applySqlFile(db: PGlite, path: string) {
  const sql = readFileSync(path, "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) await db.exec(statement);
  }
}

function authMigrations(from?: string, through?: string): string[] {
  return readdirSync(AUTH_MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => (!from || f > from) && (!through || f <= `${through}.sql`))
    .sort();
}

async function authDb(through?: string) {
  const db = new PGlite();
  for (const file of authMigrations(undefined, through)) {
    await applySqlFile(db, join(AUTH_MIGRATIONS_DIR, file));
  }
  return db;
}

async function feedbackDb() {
  const db = new PGlite();
  const files = readdirSync(API_MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) await applySqlFile(db, join(API_MIGRATIONS_DIR, file));
  return db;
}

async function addUser(db: PGlite, id: string, nearAccountId: string) {
  await db.query(`INSERT INTO "user" (id, name, email) VALUES ($1, $1, $2)`, [
    id,
    `${id}@example.com`,
  ]);
  await db.query(
    `INSERT INTO near_account (id, user_id, account_id, network, public_key, is_primary, created_at)
     VALUES ($1, $2, $3, 'mainnet', 'ed25519:x', true, now())`,
    [`na_${id}`, id, nearAccountId],
  );
}

async function addOrg(db: PGlite, id: string, slug: string) {
  await db.query(
    `INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $2, now())`,
    [id, slug],
  );
}

async function addMember(db: PGlite, id: string, orgId: string, userId: string, role: string) {
  await db.query(
    `INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`,
    [id, orgId, userId, role],
  );
}

async function addTeam(db: PGlite, id: string, orgId: string, name: string, members: string[]) {
  await db.query(`INSERT INTO team (id, name, organization_id) VALUES ($1, $2, $3)`, [
    id,
    name,
    orgId,
  ]);
  for (const userId of members) {
    await db.query(`INSERT INTO team_member (id, team_id, user_id) VALUES ($1, $2, $3)`, [
      `tm_${id}_${userId}`,
      id,
      userId,
    ]);
  }
}

/**
 * Feedback's auth DB: acme (also on nearbuilders) delegates acme-app to its Ops team, bob is
 * the only Ops member. solo only exists on feedback.
 */
async function seedFeedbackAuth() {
  const db = await authDb();
  await addUser(db, "fb_alice", "alice.near");
  await addUser(db, "fb_bob", "bob.near");
  await addUser(db, "fb_carol", "carol.near");
  await addOrg(db, "fb_acme", "acme");
  await addOrg(db, "fb_solo", "solo");
  await addMember(db, "fm_alice", "fb_acme", "fb_alice", "owner");
  await addMember(db, "fm_bob", "fb_acme", "fb_bob", "member");
  await addMember(db, "fm_carol", "fb_solo", "fb_carol", "owner");
  await addTeam(db, "fb_ops", "fb_acme", "Ops", ["fb_bob"]);
  await addTeam(db, "fb_qa", "fb_solo", "QA", ["fb_carol"]);
  await db.query(
    `INSERT INTO apikey (id, name, reference_id, key, created_at, updated_at)
     VALUES ('key_acme', 'ci', 'fb_acme', 'hashed', now(), now())`,
  );
  await db.query(
    `INSERT INTO session (id, expires_at, token, user_id) VALUES ('s1', now() + interval '1 day', 't1', 'fb_alice')`,
  );
  return db;
}

/** nearbuilders.org's auth DB: same alice and bob under other ids, acme with an "ops" team. */
async function seedSharedAuth(db: PGlite) {
  await addUser(db, "nb_alice", "alice.near");
  await addUser(db, "nb_bob", "bob.near");
  await addOrg(db, "nb_acme", "acme");
  await addMember(db, "nm_alice", "nb_acme", "nb_alice", "owner");
}

async function seedProjects(db: PGlite) {
  await db.query(
    `INSERT INTO projects (slug, name, owner_org_id, managing_team_id) VALUES
       ('acme-app', 'Acme', 'fb_acme', 'fb_ops'),
       ('solo-app', 'Solo', 'fb_solo', 'fb_qa'),
       ('legacy', 'Legacy', NULL, NULL)`,
  );
}

async function sharedAuthAtLatest() {
  const db = await authDb("0000_sturdy_lady_vermin");
  await seedSharedAuth(db);
  for (const file of authMigrations("0000_sturdy_lady_vermin.sql")) {
    await applySqlFile(db, join(AUTH_MIGRATIONS_DIR, file));
  }
  await addTeam(db, "nb_ops", "nb_acme", "ops", []);
  return db;
}

async function projectRow(db: PGlite, slug: string) {
  const { rows } = await db.query<{ owner_org_id: string | null; managing_team_id: string | null }>(
    `SELECT owner_org_id, managing_team_id FROM projects WHERE slug = $1`,
    [slug],
  );
  return rows[0];
}

describe("shared auth schema check", () => {
  it("reports a 0000 database as behind and lists what each migration still adds", async () => {
    const report = await checkAuthSchema(await authDb("0000_sturdy_lady_vermin"));
    expect(report.upToDate).toBe(false);
    expect(report.appliedThrough).toBe("0000_sturdy_lady_vermin");
    expect(report.pending.map((m) => m.tag)).toEqual([
      "0002_third_captain_stacy",
      "0003_teams_workspaces",
      "0004_futuristic_mandrill",
      "0005_blushing_george_stacy",
      "0006_device_link_claim",
      "0007_onboarding_code_event",
      "0008_pale_exiles",
      "0009_org-approval",
      "0010_preserve-approved-organizations",
    ]);
  });

  it("tells 0009 from 0010 by the requested_by foreign key's delete rule", async () => {
    const report = await checkAuthSchema(await authDb("0009_org-approval"));
    expect(report.appliedThrough).toBe("0009_org-approval");
    expect(report.pending).toEqual([
      {
        tag: "0010_preserve-approved-organizations",
        missing: ["constraint organization_requested_by_user_id_fk ON DELETE set null"],
      },
    ]);
  });

  it("migrates a populated 0000 database forward to 0010 without losing rows", async () => {
    const db = await authDb("0000_sturdy_lady_vermin");
    await seedSharedAuth(db);
    const count = async (table: string) =>
      Number((await db.query<{ n: number }>(`SELECT count(*) AS n FROM "${table}"`)).rows[0]!.n);
    const before = {
      user: await count("user"),
      near_account: await count("near_account"),
      organization: await count("organization"),
      member: await count("member"),
    };

    for (const file of authMigrations("0000_sturdy_lady_vermin.sql")) {
      await applySqlFile(db, join(AUTH_MIGRATIONS_DIR, file));
    }

    expect((await checkAuthSchema(db)).upToDate).toBe(true);
    for (const [table, n] of Object.entries(before)) expect(await count(table)).toBe(n);
    const { rows } = await db.query<{ status: string }>(`SELECT status FROM organization`);
    expect(rows).toEqual([{ status: "active" }]);
  });
});

describe("shared auth cutover", () => {
  async function setup() {
    const source = await seedFeedbackAuth();
    const shared = await sharedAuthAtLatest();
    const feedback = await feedbackDb();
    await seedProjects(feedback);
    const plan = planRemap(
      await loadAuthSnapshot(source),
      await loadAuthSnapshot(shared),
      await loadProjectRefs(feedback),
    );
    return { source, shared, feedback, plan };
  }

  it("dry run executes and verifies every write, then leaves both databases untouched", async () => {
    const { shared, feedback, plan } = await setup();
    expect(plan.conflicts).toEqual([]);

    await executePlan(shared, feedback, plan, { apply: false });

    expect(await projectRow(feedback, "acme-app")).toEqual({
      owner_org_id: "fb_acme",
      managing_team_id: "fb_ops",
    });
    const { rows } = await shared.query(`SELECT id FROM organization WHERE id = 'fb_solo'`);
    expect(rows).toHaveLength(0);
  });

  it("rewrites projects onto shared orgs/teams and keeps round managers' access", async () => {
    const { source, shared, feedback, plan } = await setup();
    expect(plan.apiKeysToReissue.map((k) => k.id)).toEqual(["key_acme"]);
    expect(plan.sessionsDropped).toBe(1);

    await executePlan(shared, feedback, plan, { apply: true });

    expect(await projectRow(feedback, "acme-app")).toEqual({
      owner_org_id: "nb_acme",
      managing_team_id: "nb_ops",
    });
    expect(await projectRow(feedback, "solo-app")).toEqual({
      owner_org_id: "fb_solo",
      managing_team_id: "fb_qa",
    });
    expect(await projectRow(feedback, "legacy")).toEqual({
      owner_org_id: null,
      managing_team_id: null,
    });

    // bob manages acme-app through the Ops team, as he did on feedback's own auth DB.
    const teamMembers = async (teamId: string) =>
      (
        await shared.query<{ user_id: string }>(
          `SELECT user_id FROM team_member WHERE team_id = $1`,
          [teamId],
        )
      ).rows.map((r) => r.user_id);
    const memberRole = async (orgId: string, userId: string) =>
      (
        await shared.query<{ role: string }>(
          `SELECT role FROM member WHERE organization_id = $1 AND user_id = $2`,
          [orgId, userId],
        )
      ).rows[0]?.role;

    const acme = { ownerOrgId: "nb_acme", managingTeamId: "nb_ops" };
    const bob: RoundActor = {
      activeOrganizationId: "nb_acme",
      orgRole: await memberRole("nb_acme", "nb_bob"),
    };
    expect(bob.orgRole).toBe("member");
    expect(needsTeamCheck(acme, bob)).toBe(true);
    bob.inManagingTeam = (await teamMembers("nb_ops")).includes("nb_bob");
    expect(canManageRound({ ownerAccountId: "x.near" }, acme, bob)).toBe(true);

    // carol's org, team and user were copied with their ids, so she still manages solo-app.
    const solo = { ownerOrgId: "fb_solo", managingTeamId: "fb_qa" };
    const carol: RoundActor = {
      activeOrganizationId: "fb_solo",
      orgRole: await memberRole("fb_solo", "fb_carol"),
    };
    expect(carol.orgRole).toBe("owner");
    expect(canManageRound({ ownerAccountId: "x.near" }, solo, carol)).toBe(true);
    const { rows: carolNear } = await shared.query(
      `SELECT user_id FROM near_account WHERE account_id = 'carol.near'`,
    );
    expect(carolNear).toEqual([{ user_id: "fb_carol" }]);

    // Re-running against the cut-over state plans nothing more.
    const again = planRemap(
      await loadAuthSnapshot(source),
      await loadAuthSnapshot(shared),
      await loadProjectRefs(feedback),
    );
    expect(again.conflicts).toEqual([]);
    expect(again.projectUpdates).toEqual([]);
  });

  it("refuses to overwrite a project that changed after the plan was made", async () => {
    const { shared, feedback, plan } = await setup();
    await feedback.query(`UPDATE projects SET managing_team_id = NULL WHERE slug = 'acme-app'`);

    await expect(executePlan(shared, feedback, plan, { apply: true })).rejects.toThrow(
      "Project acme-app changed since the plan was made",
    );
    const { rows } = await shared.query(`SELECT id FROM organization WHERE id = 'fb_solo'`);
    expect(rows).toHaveLength(0);
  });
});
