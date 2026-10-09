/**
 * Remap plan for moving feedback onto the shared nearbuilders.org auth database (#110).
 *
 * Pure: takes snapshots of the two auth databases and feedback's project references and
 * decides, without touching any database, which shared-DB org/team each feedback org/team
 * becomes, which auth rows must be copied (ids preserved) so round managers keep their
 * access, and how `projects.owner_org_id` / `projects.managing_team_id` are rewritten.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthNearAccount {
  id: string;
  userId: string;
  accountId: string;
  network: string;
  publicKey: string;
  isPrimary: boolean | null;
  createdAt: Date;
}

export interface AuthAccount {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface AuthTeam {
  id: string;
  name: string;
  organizationId: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthMember {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface AuthTeamMember {
  id: string;
  teamId: string;
  userId: string;
  createdAt: Date;
}

export interface AuthApiKey {
  id: string;
  name: string | null;
  referenceId: string;
}

export interface AuthSnapshot {
  users: AuthUser[];
  nearAccounts: AuthNearAccount[];
  accounts: AuthAccount[];
  organizations: AuthOrganization[];
  teams: AuthTeam[];
  members: AuthMember[];
  teamMembers: AuthTeamMember[];
  apiKeys: AuthApiKey[];
  sessionCount: number;
}

export interface ProjectRef {
  id: string;
  slug: string;
  ownerOrgId: string | null;
  managingTeamId: string | null;
}

/** Hand-picked source id → shared id pairs, for orgs/teams whose slug or name differs. */
export interface RemapOverrides {
  organizations?: Record<string, string>;
  teams?: Record<string, string>;
}

export type Resolution<T extends string> =
  | { kind: "same-id"; targetId: string }
  | { kind: T; targetId: string }
  | { kind: "override"; targetId: string }
  | { kind: "copy"; targetId: string };

export interface OrgMapping {
  sourceId: string;
  slug: string;
  resolution: Resolution<"slug">;
}

export interface TeamMapping {
  sourceId: string;
  name: string;
  sourceOrganizationId: string;
  resolution: Resolution<"name">;
}

export interface UserMapping {
  sourceId: string;
  resolution: Resolution<"near-account" | "email">;
}

export interface ProjectUpdate {
  projectId: string;
  slug: string;
  from: { ownerOrgId: string | null; managingTeamId: string | null };
  to: { ownerOrgId: string | null; managingTeamId: string | null };
}

export interface RemapPlan {
  organizations: OrgMapping[];
  teams: TeamMapping[];
  users: UserMapping[];
  /** Rows to insert into the shared auth DB, already rewritten to shared ids. */
  inserts: {
    users: AuthUser[];
    nearAccounts: AuthNearAccount[];
    accounts: AuthAccount[];
    organizations: AuthOrganization[];
    teams: AuthTeam[];
    members: AuthMember[];
    teamMembers: AuthTeamMember[];
  };
  projectUpdates: ProjectUpdate[];
  /** Memberships already present in the shared DB with a different role; the shared role wins. */
  roleDifferences: {
    organizationId: string;
    userId: string;
    sourceRole: string;
    targetRole: string;
  }[];
  /** Feedback API keys that will not exist in the shared DB and must be re-issued. */
  apiKeysToReissue: AuthApiKey[];
  /** Feedback sessions that will be dropped; their users sign in again. */
  sessionsDropped: number;
  /** Anything that blocks the cutover. A plan with conflicts must not be applied. */
  conflicts: string[];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function nearKey(account: { accountId: string; network: string }): string {
  return `${account.network}:${account.accountId.toLowerCase()}`;
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

export function planRemap(
  source: AuthSnapshot,
  target: AuthSnapshot,
  projects: ProjectRef[],
  overrides: RemapOverrides = {},
): RemapPlan {
  const conflicts: string[] = [];

  const sourceOrgs = byId(source.organizations);
  const sourceTeams = byId(source.teams);
  const sourceUsers = byId(source.users);
  const targetOrgs = byId(target.organizations);
  const targetTeams = byId(target.teams);
  const targetUsers = byId(target.users);
  const targetOrgBySlug = new Map(target.organizations.map((o) => [o.slug, o]));

  // Orgs that matter: the ones feedback projects point at, directly or through a team.
  const relevantOrgIds = new Set<string>();
  for (const project of projects) {
    if (project.ownerOrgId && sourceOrgs.has(project.ownerOrgId)) {
      relevantOrgIds.add(project.ownerOrgId);
    }
    const team = project.managingTeamId ? sourceTeams.get(project.managingTeamId) : undefined;
    if (team && sourceOrgs.has(team.organizationId)) relevantOrgIds.add(team.organizationId);
  }

  const orgMap = new Map<string, string>();
  const organizations: OrgMapping[] = [];
  const orgInserts: AuthOrganization[] = [];
  for (const orgId of [...relevantOrgIds].sort()) {
    const org = sourceOrgs.get(orgId)!;
    const override = overrides.organizations?.[orgId];
    let resolution: Resolution<"slug">;
    if (override) {
      if (!targetOrgs.has(override)) {
        conflicts.push(`Override maps org ${orgId} to ${override}, which is not in the shared DB`);
        continue;
      }
      resolution = { kind: "override", targetId: override };
    } else if (targetOrgs.has(orgId)) {
      resolution = { kind: "same-id", targetId: orgId };
    } else if (targetOrgBySlug.has(org.slug)) {
      resolution = { kind: "slug", targetId: targetOrgBySlug.get(org.slug)!.id };
    } else {
      resolution = { kind: "copy", targetId: orgId };
      orgInserts.push(org);
    }
    orgMap.set(orgId, resolution.targetId);
    organizations.push({ sourceId: orgId, slug: org.slug, resolution });
  }

  const teamMap = new Map<string, string>();
  const teams: TeamMapping[] = [];
  const teamInserts: AuthTeam[] = [];
  const relevantTeams = source.teams
    .filter((team) => orgMap.has(team.organizationId))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const team of relevantTeams) {
    const targetOrgId = orgMap.get(team.organizationId)!;
    const override = overrides.teams?.[team.id];
    let resolution: Resolution<"name">;
    if (override) {
      const overrideTeam = targetTeams.get(override);
      if (!overrideTeam) {
        conflicts.push(
          `Override maps team ${team.id} to ${override}, which is not in the shared DB`,
        );
        continue;
      }
      if (overrideTeam.organizationId !== targetOrgId) {
        conflicts.push(
          `Override maps team ${team.id} to ${override}, which belongs to another organization`,
        );
        continue;
      }
      resolution = { kind: "override", targetId: override };
    } else if (targetTeams.has(team.id)) {
      if (targetTeams.get(team.id)!.organizationId !== targetOrgId) {
        conflicts.push(
          `Team ${team.id} exists in the shared DB under a different organization than ${targetOrgId}`,
        );
        continue;
      }
      resolution = { kind: "same-id", targetId: team.id };
    } else {
      const sameName = target.teams.filter(
        (t) =>
          t.organizationId === targetOrgId && normalizeName(t.name) === normalizeName(team.name),
      );
      if (sameName.length > 1) {
        conflicts.push(
          `Team "${team.name}" (${team.id}) matches ${sameName.length} teams in shared org ${targetOrgId}; add an override`,
        );
        continue;
      }
      if (sameName.length === 1) {
        resolution = { kind: "name", targetId: sameName[0]!.id };
      } else {
        resolution = { kind: "copy", targetId: team.id };
        teamInserts.push({ ...team, organizationId: targetOrgId });
      }
    }
    teamMap.set(team.id, resolution.targetId);
    teams.push({
      sourceId: team.id,
      name: team.name,
      sourceOrganizationId: team.organizationId,
      resolution,
    });
  }

  // Users that hold a membership in a relevant org or team, so access survives the cutover.
  const relevantMembers = source.members.filter((m) => orgMap.has(m.organizationId));
  const relevantTeamMembers = source.teamMembers.filter((m) => teamMap.has(m.teamId));
  const relevantUserIds = new Set([
    ...relevantMembers.map((m) => m.userId),
    ...relevantTeamMembers.map((m) => m.userId),
  ]);

  const targetUserByNear = new Map<string, string>();
  for (const account of target.nearAccounts) targetUserByNear.set(nearKey(account), account.userId);
  const targetUserByEmail = new Map(target.users.map((u) => [normalizeName(u.email), u.id]));

  const userMap = new Map<string, string>();
  const users: UserMapping[] = [];
  const userInserts: AuthUser[] = [];
  const nearAccountInserts: AuthNearAccount[] = [];
  const accountInserts: AuthAccount[] = [];
  for (const userId of [...relevantUserIds].sort()) {
    const user = sourceUsers.get(userId);
    if (!user) {
      conflicts.push(
        `Membership references user ${userId}, which is missing from the feedback auth DB`,
      );
      continue;
    }
    const nearAccounts = source.nearAccounts.filter((a) => a.userId === userId);
    const nearMatches = new Set(
      nearAccounts.map((a) => targetUserByNear.get(nearKey(a))).filter((id): id is string => !!id),
    );
    let resolution: UserMapping["resolution"];
    if (targetUsers.has(userId)) {
      resolution = { kind: "same-id", targetId: userId };
    } else if (nearMatches.size > 1) {
      conflicts.push(
        `User ${userId}'s NEAR accounts belong to ${nearMatches.size} different shared users: ${[...nearMatches].join(", ")}`,
      );
      continue;
    } else if (nearMatches.size === 1) {
      resolution = { kind: "near-account", targetId: [...nearMatches][0]! };
    } else if (targetUserByEmail.has(normalizeName(user.email))) {
      resolution = { kind: "email", targetId: targetUserByEmail.get(normalizeName(user.email))! };
    } else {
      resolution = { kind: "copy", targetId: userId };
      userInserts.push(user);
      nearAccountInserts.push(...nearAccounts);
      accountInserts.push(...source.accounts.filter((a) => a.userId === userId));
    }
    userMap.set(userId, resolution.targetId);
    users.push({ sourceId: userId, resolution });
  }

  const targetMemberKeys = new Map(
    target.members.map((m) => [`${m.organizationId}|${m.userId}`, m]),
  );
  const memberInserts: AuthMember[] = [];
  const roleDifferences: RemapPlan["roleDifferences"] = [];
  const plannedMemberKeys = new Set<string>();
  for (const member of relevantMembers) {
    const userId = userMap.get(member.userId);
    if (!userId) continue;
    const organizationId = orgMap.get(member.organizationId)!;
    const key = `${organizationId}|${userId}`;
    const existing = targetMemberKeys.get(key);
    if (existing) {
      if (existing.role !== member.role) {
        roleDifferences.push({
          organizationId,
          userId,
          sourceRole: member.role,
          targetRole: existing.role,
        });
      }
      continue;
    }
    if (plannedMemberKeys.has(key)) continue;
    plannedMemberKeys.add(key);
    memberInserts.push({ ...member, organizationId, userId });
  }

  const targetTeamMemberKeys = new Set(target.teamMembers.map((m) => `${m.teamId}|${m.userId}`));
  const teamMemberInserts: AuthTeamMember[] = [];
  for (const teamMember of relevantTeamMembers) {
    const userId = userMap.get(teamMember.userId);
    if (!userId) continue;
    const teamId = teamMap.get(teamMember.teamId)!;
    const key = `${teamId}|${userId}`;
    if (targetTeamMemberKeys.has(key)) continue;
    targetTeamMemberKeys.add(key);
    teamMemberInserts.push({ ...teamMember, teamId, userId });
  }

  // Orgs/teams that exist in the feedback DB but could not be mapped already have a conflict.
  const projectUpdates: ProjectUpdate[] = [];
  for (const project of projects) {
    let ownerOrgId = project.ownerOrgId;
    if (ownerOrgId) {
      if (orgMap.has(ownerOrgId)) ownerOrgId = orgMap.get(ownerOrgId)!;
      else if (sourceOrgs.has(ownerOrgId)) continue;
      else if (!targetOrgs.has(ownerOrgId)) {
        conflicts.push(
          `Project ${project.slug} is owned by org ${ownerOrgId}, which is in neither auth DB`,
        );
        continue;
      }
    }
    let managingTeamId = project.managingTeamId;
    if (managingTeamId) {
      if (teamMap.has(managingTeamId)) managingTeamId = teamMap.get(managingTeamId)!;
      else if (sourceTeams.has(managingTeamId)) continue;
      else if (!targetTeams.has(managingTeamId)) {
        conflicts.push(
          `Project ${project.slug} is managed by team ${managingTeamId}, which is in neither auth DB`,
        );
        continue;
      }
      const teamOrgId =
        teamInserts.find((t) => t.id === managingTeamId)?.organizationId ??
        targetTeams.get(managingTeamId)?.organizationId;
      if (teamOrgId !== ownerOrgId) {
        conflicts.push(
          `Project ${project.slug}'s managing team ${managingTeamId} would not belong to its owning org ${ownerOrgId}`,
        );
        continue;
      }
    }
    if (ownerOrgId !== project.ownerOrgId || managingTeamId !== project.managingTeamId) {
      projectUpdates.push({
        projectId: project.id,
        slug: project.slug,
        from: { ownerOrgId: project.ownerOrgId, managingTeamId: project.managingTeamId },
        to: { ownerOrgId, managingTeamId },
      });
    }
  }

  return {
    organizations,
    teams,
    users,
    inserts: {
      users: userInserts,
      nearAccounts: nearAccountInserts,
      accounts: accountInserts,
      organizations: orgInserts,
      teams: teamInserts,
      members: memberInserts,
      teamMembers: teamMemberInserts,
    },
    projectUpdates,
    roleDifferences,
    apiKeysToReissue: source.apiKeys,
    sessionsDropped: source.sessionCount,
    conflicts,
  };
}

/** Human-readable summary for the dry-run report. */
export function summarizePlan(plan: RemapPlan): string {
  const count = <T extends { resolution: { kind: string } }>(rows: T[], kind: string) =>
    rows.filter((row) => row.resolution.kind === kind).length;
  const lines = [
    `Organizations: ${plan.organizations.length} (same id ${count(plan.organizations, "same-id")}, by slug ${count(plan.organizations, "slug")}, override ${count(plan.organizations, "override")}, copied ${count(plan.organizations, "copy")})`,
    `Teams: ${plan.teams.length} (same id ${count(plan.teams, "same-id")}, by name ${count(plan.teams, "name")}, override ${count(plan.teams, "override")}, copied ${count(plan.teams, "copy")})`,
    `Users: ${plan.users.length} (same id ${count(plan.users, "same-id")}, by NEAR account ${count(plan.users, "near-account")}, by email ${count(plan.users, "email")}, copied ${count(plan.users, "copy")})`,
    `Rows to insert: ${plan.inserts.users.length} users, ${plan.inserts.nearAccounts.length} NEAR accounts, ${plan.inserts.accounts.length} accounts, ${plan.inserts.organizations.length} orgs, ${plan.inserts.teams.length} teams, ${plan.inserts.members.length} members, ${plan.inserts.teamMembers.length} team members`,
    `Projects to rewrite: ${plan.projectUpdates.length}`,
    ...plan.projectUpdates.map(
      (u) =>
        `  ${u.slug}: org ${u.from.ownerOrgId ?? "-"} -> ${u.to.ownerOrgId ?? "-"}, team ${u.from.managingTeamId ?? "-"} -> ${u.to.managingTeamId ?? "-"}`,
    ),
    `Role differences (shared role kept): ${plan.roleDifferences.length}`,
    ...plan.roleDifferences.map(
      (d) =>
        `  org ${d.organizationId} user ${d.userId}: feedback ${d.sourceRole}, shared ${d.targetRole}`,
    ),
    `API keys to re-issue: ${plan.apiKeysToReissue.length}`,
    ...plan.apiKeysToReissue.map(
      (k) => `  ${k.name ?? "(unnamed)"} [${k.id}] for ${k.referenceId}`,
    ),
    `Sessions dropped (users sign in again): ${plan.sessionsDropped}`,
    `Conflicts: ${plan.conflicts.length}`,
    ...plan.conflicts.map((c) => `  ! ${c}`),
  ];
  return lines.join("\n");
}
