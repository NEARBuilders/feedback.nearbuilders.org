export interface RoundAccessSubject {
  ownerAccountId: string;
}

export interface ProjectAccessSubject {
  ownerOrgId: string | null;
}

export interface RoundActor {
  /** The caller's active organization, if the session has one. */
  activeOrganizationId?: string | null;
  /** The caller's primary linked NEAR account, if any. */
  accountId?: string | null;
}

/**
 * Who may manage a round (close it, remove feedback, delete it):
 * the project's owning organization (#70). Rounds on a project backfilled before
 * org ownership existed have no owning org yet, so they fall back to the
 * round's creator.
 */
export function canManageRound(
  round: RoundAccessSubject,
  project: ProjectAccessSubject | null,
  actor: RoundActor,
): boolean {
  if (project?.ownerOrgId) return actor.activeOrganizationId === project.ownerOrgId;
  return !!actor.accountId && actor.accountId === round.ownerAccountId;
}
