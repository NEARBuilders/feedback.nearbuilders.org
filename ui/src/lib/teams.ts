export const TEAM_NAME_MAX = 64;

export interface OrgMemberLike {
  userId: string;
  user?: { name?: string | null; email?: string | null } | null;
}

export interface TeamMemberCandidate {
  userId: string;
  label: string;
}

export function normalizeTeamName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function isValidTeamName(name: string): boolean {
  const normalized = normalizeTeamName(name);
  return normalized.length > 0 && normalized.length <= TEAM_NAME_MAX;
}

export function memberLabel(member: OrgMemberLike): string {
  return member.user?.name?.trim() || member.user?.email?.trim() || member.userId;
}

export function labelForUser(members: OrgMemberLike[], userId: string): string {
  const match = members.find((member) => member.userId === userId);
  return match ? memberLabel(match) : userId;
}

export function teamMemberCandidates(
  orgMembers: OrgMemberLike[],
  teamUserIds: string[],
): TeamMemberCandidate[] {
  const inTeam = new Set(teamUserIds);
  return orgMembers
    .filter((member) => !inTeam.has(member.userId))
    .map((member) => ({ userId: member.userId, label: memberLabel(member) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function describeDelegation(
  teams: Array<{ id: string; name: string }>,
  managingTeamId: string | null,
): string {
  if (!managingTeamId) return "Any organization member";
  return teams.find((team) => team.id === managingTeamId)?.name ?? "Unknown team";
}

export interface DelegationOption {
  value: string;
  label: string;
}

export function delegationOptions(
  teams: Array<{ id: string; name: string }>,
  managingTeamId: string | null,
): DelegationOption[] {
  const options: DelegationOption[] = [
    { value: "", label: "Any organization member" },
    ...teams.map((team) => ({ value: team.id, label: team.name })),
  ];
  if (managingTeamId && !teams.some((team) => team.id === managingTeamId)) {
    options.push({ value: managingTeamId, label: "Deleted team (only owners and admins)" });
  }
  return options;
}

export function projectsDelegatedTo<T extends { managingTeamId: string | null }>(
  projects: T[],
  teamId: string,
): T[] {
  return projects.filter((project) => project.managingTeamId === teamId);
}
