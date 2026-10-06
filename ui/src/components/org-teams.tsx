import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Badge, Button, Card, Input, SectionHeader, Skeleton } from "@/components";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateProjectQueries, myProjectsQueryOptions } from "@/lib/queries/projects";
import {
  delegationOptions,
  describeDelegation,
  isValidTeamName,
  labelForUser,
  normalizeTeamName,
  type OrgMemberLike,
  projectsDelegatedTo,
  TEAM_NAME_MAX,
  teamMemberCandidates,
} from "@/lib/teams";

const teamsKey = (orgId: string) => ["org-teams", orgId] as const;
const teamMembersKey = (teamId: string) => ["org-team-members", teamId] as const;

interface OrgTeamsProps {
  orgId: string;
  orgMembers: OrgMemberLike[];
  canManage: boolean;
  isActiveOrg: boolean;
}

export function OrgTeams({ orgId, orgMembers, canManage, isActiveOrg }: OrgTeamsProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [deleteTeam, setDeleteTeam] = useState<{ id: string; name: string } | null>(null);

  const teamsQuery = useQuery({
    queryKey: teamsKey(orgId),
    queryFn: () => apiClient.auth.listTeams({ organizationId: orgId }),
    enabled: !!orgId,
    retry: false,
  });
  const teams = teamsQuery.data ?? [];

  const projectsQuery = useQuery({
    ...myProjectsQueryOptions(apiClient),
    enabled: isActiveOrg && canManage,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.auth.createTeam({ name: normalizeTeamName(name), organizationId: orgId }),
    onSuccess: (team) => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: teamsKey(orgId) });
      toast.success(`Created ${team.name}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const delegated = projectsDelegatedTo(projectsQuery.data ?? [], teamId);
      await Promise.all(
        delegated.map((project) =>
          apiClient.setProjectManagingTeam({ id: project.id, teamId: null }),
        ),
      );
      return apiClient.auth.deleteTeam({ teamId, organizationId: orgId });
    },
    onSuccess: () => {
      setDeleteTeam(null);
      void queryClient.invalidateQueries({ queryKey: teamsKey(orgId) });
      void invalidateProjectQueries(queryClient);
      toast.success("Team deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8" data-testid="org-teams">
      <section className="space-y-3">
        <SectionHeader title="Teams" />
        <p className="text-sm text-muted-foreground">
          Teams group organization members. Delegate a project to a team below to limit who can
          manage its rounds.
        </p>

        {canManage && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (isValidTeamName(name)) createMutation.mutate();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New team name"
              aria-label="New team name"
              maxLength={TEAM_NAME_MAX}
              className="max-w-xs"
              disabled={createMutation.isPending}
            />
            <Button type="submit" disabled={!isValidTeamName(name) || createMutation.isPending}>
              {createMutation.isPending ? "creating..." : "create team"}
            </Button>
          </form>
        )}

        {teamsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((n) => (
              <Skeleton key={n} className="h-20 w-full" />
            ))}
          </div>
        ) : teamsQuery.isError ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Couldn't load teams. Teams may not be enabled for this organization yet.
            </p>
          </Card>
        ) : teams.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "No teams yet. Create one to group members and delegate project management."
                : "This organization has no teams yet."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamCard
                  team={team}
                  orgId={orgId}
                  orgMembers={orgMembers}
                  canManage={canManage}
                  onDelete={() => setDeleteTeam({ id: team.id, name: team.name })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && teams.length > 0 && (
        <ProjectDelegation teams={teams} isActiveOrg={isActiveOrg} />
      )}

      <ConfirmDialog
        open={deleteTeam !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTeam(null);
        }}
        title={`Delete ${deleteTeam?.name ?? "this team"}?`}
        description="Its members stay in the organization. Projects delegated to this team go back to any organization member."
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTeam) deleteMutation.mutate(deleteTeam.id);
        }}
      />
    </div>
  );
}

function TeamCard({
  team,
  orgId,
  orgMembers,
  canManage,
  onDelete,
}: {
  team: { id: string; name: string };
  orgId: string;
  orgMembers: OrgMemberLike[];
  canManage: boolean;
  onDelete: () => void;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");

  const membersQuery = useQuery({
    queryKey: teamMembersKey(team.id),
    queryFn: () => apiClient.auth.listTeamMembers({ teamId: team.id }),
    retry: false,
  });
  const teamUserIds = (membersQuery.data ?? []).map((member) => member.userId);
  const candidates = teamMemberCandidates(orgMembers, teamUserIds);

  const refresh = () => queryClient.invalidateQueries({ queryKey: teamMembersKey(team.id) });

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.auth.addTeamMember({ teamId: team.id, userId, organizationId: orgId }),
    onSuccess: () => {
      setSelectedUserId("");
      void refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient.auth.removeTeamMember({ teamId: team.id, userId, organizationId: orgId }),
    onSuccess: () => void refresh(),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="p-4 space-y-3" data-testid="team-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{team.name}</span>
          <Badge variant="outline">
            {teamUserIds.length} {teamUserIds.length === 1 ? "member" : "members"}
          </Badge>
        </div>
        {canManage && (
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${team.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {membersQuery.isLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : membersQuery.isError ? (
        <p className="text-xs text-muted-foreground">Couldn't load this team's members.</p>
      ) : teamUserIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No members yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {teamUserIds.map((userId) => (
            <li
              key={userId}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs"
            >
              {labelForUser(orgMembers, userId)}
              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove ${labelForUser(orgMembers, userId)} from ${team.name}`}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => removeMutation.mutate(userId)}
                  disabled={removeMutation.isPending}
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            aria-label={`Add a member to ${team.name}`}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
          >
            <option value="">Add a member…</option>
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedUserId || addMutation.isPending}
            onClick={() => addMutation.mutate(selectedUserId)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            add
          </Button>
        </div>
      )}
    </Card>
  );
}

function ProjectDelegation({
  teams,
  isActiveOrg,
}: {
  teams: Array<{ id: string; name: string }>;
  isActiveOrg: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    ...myProjectsQueryOptions(apiClient),
    enabled: isActiveOrg,
  });
  const projects = (projectsQuery.data ?? []).filter((project) => project.status === "approved");

  const delegateMutation = useMutation({
    mutationFn: (input: { id: string; teamId: string | null }) =>
      apiClient.setProjectManagingTeam(input),
    onSuccess: (project) => {
      void invalidateProjectQueries(queryClient);
      toast.success(
        project.managingTeamId
          ? `Round management delegated to ${describeDelegation(teams, project.managingTeamId)}`
          : "Any organization member can manage rounds again",
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="space-y-3" data-testid="project-delegation">
      <SectionHeader title="Round management" />
      <p className="text-sm text-muted-foreground">
        Choose who manages each project's rounds. Organization owners and admins can always manage
        them.
      </p>
      {!isActiveOrg ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Switch to this organization to delegate its projects.
          </p>
        </Card>
      ) : projectsQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : projects.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            No approved projects yet. Once a project is approved you can delegate it here.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{project.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{project.slug}</p>
                  </div>
                  <select
                    value={project.managingTeamId ?? ""}
                    onChange={(e) =>
                      delegateMutation.mutate({ id: project.id, teamId: e.target.value || null })
                    }
                    disabled={delegateMutation.isPending}
                    aria-label={`Who manages ${project.name}`}
                    className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                  >
                    {delegationOptions(teams, project.managingTeamId).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
