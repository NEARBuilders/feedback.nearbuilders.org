export interface RoundAccessSubject {
  ownerAccountId: string;
}

export interface ProjectAccessSubject {
  ownerOrgId: string | null;
  /** Team the owning org delegated round management to, if any. */
  managingTeamId?: string | null;
}

export interface RoundActor {
  /** The caller's active organization, if the session has one. */
  activeOrganizationId?: string | null;
  /** The caller's primary linked NEAR account, if any. */
  accountId?: string | null;
  /** Every NEAR account linked to the caller's session (#121); matched for ownership checks. */
  accountIds?: string[];
  /** The caller's role in their active organization. */
  orgRole?: string | null;
  /** Whether the caller belongs to the project's managing team. Only needed when one is set. */
  inManagingTeam?: boolean;
}

/** Whether `accountId` is the caller's primary account or any other NEAR account they linked. */
export function actorOwnsAccount(actor: RoundActor, accountId: string): boolean {
  return actor.accountId === accountId || !!actor.accountIds?.includes(accountId);
}

const ORG_ADMIN_ROLES = ["owner", "admin"];

export function isOrgAdminRole(role: string | null | undefined): boolean {
  return !!role && ORG_ADMIN_ROLES.includes(role);
}

/**
 * True when the team membership of the caller has to be looked up: the caller is in the
 * owning org, the project is delegated to a team, and the caller is not an org owner/admin
 * (who can always manage their org's projects).
 */
export function needsTeamCheck(project: ProjectAccessSubject | null, actor: RoundActor): boolean {
  return (
    !!project?.ownerOrgId &&
    !!project.managingTeamId &&
    actor.activeOrganizationId === project.ownerOrgId &&
    !isOrgAdminRole(actor.orgRole)
  );
}

/**
 * Who may manage a round (close it, edit its readme, remove feedback, delete it):
 * the project's owning organization (#70). When the org delegated the project to a
 * team (#79), only that team's members and the org's owners and admins may. Rounds on a
 * project backfilled before org ownership existed have no owning org yet, so they fall
 * back to the round's creator.
 */
export function canManageRound(
  round: RoundAccessSubject,
  project: ProjectAccessSubject | null,
  actor: RoundActor,
): boolean {
  if (project?.ownerOrgId) return canManageOwnedProject(project, actor);
  return actorOwnsAccount(actor, round.ownerAccountId);
}

export function canManageProject(
  project: ProjectAccessSubject & { rounds: RoundAccessSubject[] },
  actor: RoundActor,
): boolean {
  if (project.ownerOrgId) return canManageOwnedProject(project, actor);
  return project.rounds.some((round) => canManageRound(round, project, actor));
}

function canManageOwnedProject(project: ProjectAccessSubject, actor: RoundActor): boolean {
  if (actor.activeOrganizationId !== project.ownerOrgId) return false;
  if (!project.managingTeamId) return true;
  return isOrgAdminRole(actor.orgRole) || actor.inManagingTeam === true;
}

export interface FeedbackVisibilitySubject {
  isPrivate: boolean;
}

/**
 * Whether the caller may read every submission on a round (#101). Public rounds are open to
 * everyone. A private round is readable by platform admins and by whoever may manage it, with
 * the same org/team rule as round management. Anyone else only ever sees their own
 * submissions, which {@link filterVisibleFeedback} enforces.
 */
export function canReadAllFeedback(
  round: RoundAccessSubject & FeedbackVisibilitySubject,
  project: ProjectAccessSubject | null,
  actor: RoundActor,
  isAdmin: boolean,
): boolean {
  if (!round.isPrivate) return true;
  return isAdmin || canManageRound(round, project, actor);
}

/**
 * Applies the visibility decision to a list: everything when `canReadAll`, otherwise only the
 * submissions authored by any of `accountIds` (none when logged out), matching how a user's
 * submissions may come from any of their linked wallets (#121).
 */
export function filterVisibleFeedback<T extends { authorAccountId: string | null }>(
  feedback: T[],
  canReadAll: boolean,
  accountIds: string[] | null | undefined,
): T[] {
  if (canReadAll) return feedback;
  if (!accountIds || accountIds.length === 0) return [];
  const authors = new Set(accountIds);
  // Anonymous submissions (#89) have no author, so only readers of the round see them.
  return feedback.filter(
    (item) => item.authorAccountId !== null && authors.has(item.authorAccountId),
  );
}
