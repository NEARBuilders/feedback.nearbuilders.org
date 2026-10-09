import type {
  AuthAccount,
  AuthApiKey,
  AuthMember,
  AuthNearAccount,
  AuthOrganization,
  AuthSnapshot,
  AuthTeam,
  AuthTeamMember,
  AuthUser,
  ProjectRef,
  RemapPlan,
} from "./plan";

/** The slice of `pg.Client` / `PGlite` the cutover needs. */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export async function loadAuthSnapshot(db: Queryable): Promise<AuthSnapshot> {
  const [
    users,
    nearAccounts,
    accounts,
    organizations,
    teams,
    members,
    teamMembers,
    apiKeys,
    sessions,
  ] = await Promise.all([
    db.query<AuthUser>(
      `SELECT id, name, email, email_verified AS "emailVerified", image,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM "user"`,
    ),
    db.query<AuthNearAccount>(
      `SELECT id, user_id AS "userId", account_id AS "accountId", network,
                public_key AS "publicKey", is_primary AS "isPrimary", created_at AS "createdAt"
         FROM near_account`,
    ),
    db.query<AuthAccount>(
      `SELECT id, account_id AS "accountId", provider_id AS "providerId", user_id AS "userId",
                access_token AS "accessToken", refresh_token AS "refreshToken", id_token AS "idToken",
                access_token_expires_at AS "accessTokenExpiresAt",
                refresh_token_expires_at AS "refreshTokenExpiresAt",
                scope, password, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM account`,
    ),
    db.query<AuthOrganization>(
      `SELECT id, name, slug, logo, metadata, created_at AS "createdAt" FROM organization`,
    ),
    db.query<AuthTeam>(
      `SELECT id, name, organization_id AS "organizationId", metadata,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM team`,
    ),
    db.query<AuthMember>(
      `SELECT id, organization_id AS "organizationId", user_id AS "userId", role,
                created_at AS "createdAt"
         FROM member`,
    ),
    db.query<AuthTeamMember>(
      `SELECT id, team_id AS "teamId", user_id AS "userId", created_at AS "createdAt"
         FROM team_member`,
    ),
    db.query<AuthApiKey>(`SELECT id, name, reference_id AS "referenceId" FROM apikey`),
    db.query<{ count: number | string }>(
      `SELECT count(*) AS count FROM session WHERE expires_at > now()`,
    ),
  ]);
  return {
    users: users.rows,
    nearAccounts: nearAccounts.rows,
    accounts: accounts.rows,
    organizations: organizations.rows,
    teams: teams.rows,
    members: members.rows,
    teamMembers: teamMembers.rows,
    apiKeys: apiKeys.rows,
    sessionCount: Number(sessions.rows[0]?.count ?? 0),
  };
}

export async function loadProjectRefs(db: Queryable): Promise<ProjectRef[]> {
  const { rows } = await db.query<ProjectRef>(
    `SELECT id, slug, owner_org_id AS "ownerOrgId", managing_team_id AS "managingTeamId"
     FROM projects
     WHERE owner_org_id IS NOT NULL OR managing_team_id IS NOT NULL
     ORDER BY slug`,
  );
  return rows;
}

async function insertRows<T>(
  db: Queryable,
  table: string,
  columns: string[],
  rows: T[],
  values: (row: T) => unknown[],
): Promise<void> {
  const columnList = columns.map((c) => `"${c}"`).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  for (const row of rows) {
    await db.query(
      `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      values(row),
    );
  }
}

/** Inserts the plan's rows into the shared auth DB. Idempotent: existing ids are left alone. */
export async function applyAuthInserts(db: Queryable, plan: RemapPlan): Promise<void> {
  const { inserts } = plan;
  await insertRows(
    db,
    "user",
    ["id", "name", "email", "email_verified", "image", "created_at", "updated_at"],
    inserts.users,
    (u) => [u.id, u.name, u.email, u.emailVerified, u.image, u.createdAt, u.updatedAt],
  );
  await insertRows(
    db,
    "near_account",
    ["id", "user_id", "account_id", "network", "public_key", "is_primary", "created_at"],
    inserts.nearAccounts,
    (a) => [a.id, a.userId, a.accountId, a.network, a.publicKey, a.isPrimary, a.createdAt],
  );
  await insertRows(
    db,
    "account",
    [
      "id",
      "account_id",
      "provider_id",
      "user_id",
      "access_token",
      "refresh_token",
      "id_token",
      "access_token_expires_at",
      "refresh_token_expires_at",
      "scope",
      "password",
      "created_at",
      "updated_at",
    ],
    inserts.accounts,
    (a) => [
      a.id,
      a.accountId,
      a.providerId,
      a.userId,
      a.accessToken,
      a.refreshToken,
      a.idToken,
      a.accessTokenExpiresAt,
      a.refreshTokenExpiresAt,
      a.scope,
      a.password,
      a.createdAt,
      a.updatedAt,
    ],
  );
  await insertRows(
    db,
    "organization",
    ["id", "name", "slug", "logo", "metadata", "created_at", "status"],
    inserts.organizations,
    (o) => [o.id, o.name, o.slug, o.logo, o.metadata, o.createdAt, "active"],
  );
  await insertRows(
    db,
    "team",
    ["id", "name", "organization_id", "metadata", "created_at", "updated_at"],
    inserts.teams,
    (t) => [t.id, t.name, t.organizationId, t.metadata, t.createdAt, t.updatedAt],
  );
  await insertRows(
    db,
    "member",
    ["id", "organization_id", "user_id", "role", "created_at"],
    inserts.members,
    (m) => [m.id, m.organizationId, m.userId, m.role, m.createdAt],
  );
  await insertRows(
    db,
    "team_member",
    ["id", "team_id", "user_id", "created_at"],
    inserts.teamMembers,
    (m) => [m.id, m.teamId, m.userId, m.createdAt],
  );
}

/**
 * Rewrites project org/team ids. Each update only applies while the row still holds the ids
 * the plan was computed from, so a project edited since the plan was made fails the cutover
 * instead of being silently overwritten.
 */
export async function applyProjectUpdates(db: Queryable, plan: RemapPlan): Promise<void> {
  for (const update of plan.projectUpdates) {
    const { rows } = await db.query(
      `UPDATE projects
       SET owner_org_id = $2, managing_team_id = $3, updated_at = now()
       WHERE id = $1
         AND owner_org_id IS NOT DISTINCT FROM $4
         AND managing_team_id IS NOT DISTINCT FROM $5
       RETURNING id`,
      [
        update.projectId,
        update.to.ownerOrgId,
        update.to.managingTeamId,
        update.from.ownerOrgId,
        update.from.managingTeamId,
      ],
    );
    if (rows.length !== 1) {
      throw new Error(`Project ${update.slug} changed since the plan was made; re-run the cutover`);
    }
  }
}

/**
 * Runs the plan's writes in one transaction per database and verifies the result. Without
 * `apply` both transactions are rolled back, which makes this the dry run.
 */
export async function executePlan(
  shared: Queryable,
  feedback: Queryable,
  plan: RemapPlan,
  { apply }: { apply: boolean },
): Promise<void> {
  if (plan.conflicts.length > 0) throw new Error("The plan has conflicts; refusing to run it");
  const rollback = async () => {
    await shared.query("ROLLBACK").catch(() => {});
    await feedback.query("ROLLBACK").catch(() => {});
  };
  await shared.query("BEGIN");
  await feedback.query("BEGIN");
  try {
    await applyAuthInserts(shared, plan);
    await applyProjectUpdates(feedback, plan);
    const problems = await verifyCutover(shared, feedback);
    if (problems.length > 0) throw new Error(`Verification failed:\n  ${problems.join("\n  ")}`);
  } catch (error) {
    await rollback();
    throw error;
  }
  if (!apply) {
    await rollback();
    return;
  }
  // Auth first: its inserts are idempotent, so a failure between the two commits is
  // recovered by re-running the cutover.
  await shared.query("COMMIT");
  await feedback.query("COMMIT");
}

/**
 * After the cutover every project must point at an org (and team) that exists in the shared
 * DB, with the team inside the owning org, or round managers lose access.
 */
export async function verifyCutover(shared: Queryable, feedback: Queryable): Promise<string[]> {
  const projects = await loadProjectRefs(feedback);
  const orgs = await shared.query<{ id: string }>(`SELECT id FROM organization`);
  const teams = await shared.query<{ id: string; organizationId: string }>(
    `SELECT id, organization_id AS "organizationId" FROM team`,
  );
  const orgIds = new Set(orgs.rows.map((o) => o.id));
  const teamOrg = new Map(teams.rows.map((t) => [t.id, t.organizationId]));
  const problems: string[] = [];
  for (const project of projects) {
    if (project.ownerOrgId && !orgIds.has(project.ownerOrgId)) {
      problems.push(`Project ${project.slug}: org ${project.ownerOrgId} is not in the shared DB`);
    }
    if (project.managingTeamId) {
      const organizationId = teamOrg.get(project.managingTeamId);
      if (!organizationId) {
        problems.push(
          `Project ${project.slug}: team ${project.managingTeamId} is not in the shared DB`,
        );
      } else if (organizationId !== project.ownerOrgId) {
        problems.push(
          `Project ${project.slug}: team ${project.managingTeamId} belongs to ${organizationId}, not ${project.ownerOrgId}`,
        );
      }
    }
  }
  return problems;
}
