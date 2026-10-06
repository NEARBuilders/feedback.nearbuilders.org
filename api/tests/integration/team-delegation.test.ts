import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  nearAuthedContext,
} from "../setup";

let counter = 0;

interface Setup {
  orgId: string;
  projectId: string;
  roundId: string;
  asOwner: Record<string, unknown>;
}

async function projectWithRound(): Promise<Setup> {
  const n = ++counter;
  const orgId = `deleg-org-${n}`;
  const asOwner = nearAuthedContext(
    `deleg-owner-${n}.near`,
    `deleg-owner-user-${n}`,
    orgId,
    "owner",
  );
  const ownerClient = await getPluginClient(asOwner);
  const round = await ownerClient.createRound({
    projectSlug: `delegation-project-${n}`,
    title: `Delegation ${n}`,
    description: "Walk through the flow.",
    formats: ["written"],
  });
  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }
  return { orgId, projectId: round.projectRecordId, roundId: round.id, asOwner };
}

function member(setup: Setup, name: string, role: string) {
  return nearAuthedContext(`${name}.near`, `${name}-user`, setup.orgId, role);
}

beforeEach(() => {
  authListTeams.mockReset();
  authListTeamMembers.mockReset();
  authListTeams.mockResolvedValue([{ id: "team-a" }, { id: "team-b" }]);
  authListTeamMembers.mockImplementation(async ({ teamId }: { teamId: string }) =>
    teamId === "team-a" ? [{ userId: "teamed-user" }] : [],
  );
});

describe("setProjectManagingTeam", () => {
  it("lets an org owner delegate a project to one of the org's teams", async () => {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);

    const project = await owner.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" });
    expect(project.managingTeamId).toBe("team-a");
    expect(authListTeams).toHaveBeenCalledWith({ organizationId: setup.orgId });

    const listed = await owner.listMyProjects();
    expect(listed.find((p) => p.id === setup.projectId)?.managingTeamId).toBe("team-a");
  });

  it("lets an org admin and a site admin delegate too", async () => {
    const setup = await projectWithRound();
    const orgAdmin = await getPluginClient(member(setup, "deleg-orgadmin", "admin"));
    await expect(
      orgAdmin.setProjectManagingTeam({ id: setup.projectId, teamId: "team-b" }),
    ).resolves.toMatchObject({ managingTeamId: "team-b" });

    const siteAdmin = await getPluginClient(adminContext());
    await expect(
      siteAdmin.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" }),
    ).resolves.toMatchObject({ managingTeamId: "team-a" });
  });

  it("clears the delegation with a null team", async () => {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);
    await owner.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" });
    const cleared = await owner.setProjectManagingTeam({ id: setup.projectId, teamId: null });
    expect(cleared.managingTeamId).toBeNull();
  });

  it("rejects plain members, other orgs and signed-out callers", async () => {
    const setup = await projectWithRound();
    const plain = await getPluginClient(member(setup, "deleg-plain", "member"));
    await expect(
      plain.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" }),
    ).rejects.toThrow("owners and admins");

    const otherOrg = await getPluginClient(
      nearAuthedContext("deleg-other.near", "deleg-other-user", "someone-elses-org", "owner"),
    );
    await expect(
      otherOrg.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" }),
    ).rejects.toThrow("owners and admins");

    const anon = await getPluginClient();
    await expect(
      anon.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" }),
    ).rejects.toThrow("Authentication required");
  });

  it("rejects a team that is not in the project's organization", async () => {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);
    await expect(
      owner.setProjectManagingTeam({ id: setup.projectId, teamId: "team-from-elsewhere" }),
    ).rejects.toThrow("doesn't belong");
  });

  it("rejects delegation when the teams cannot be verified", async () => {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);
    authListTeams.mockRejectedValue(new Error("auth down"));
    await expect(
      owner.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" }),
    ).rejects.toThrow("verify");
  });

  it("fails with not found for an unknown project", async () => {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);
    await expect(
      owner.setProjectManagingTeam({
        id: "00000000-0000-0000-0000-000000000000",
        teamId: "team-a",
      }),
    ).rejects.toThrow();
  });
});

describe("managing rounds on a delegated project", () => {
  async function delegated() {
    const setup = await projectWithRound();
    const owner = await getPluginClient(setup.asOwner);
    await owner.setProjectManagingTeam({ id: setup.projectId, teamId: "team-a" });
    return setup;
  }

  it("lets the managing team's members manage the round", async () => {
    const setup = await delegated();
    const teamed = await getPluginClient(
      nearAuthedContext("teamed.near", "teamed-user", setup.orgId, "member"),
    );

    const round = await teamed.getRound({ id: setup.roundId });
    expect(round.canManage).toBe(true);
    await expect(
      teamed.updateRoundReadme({ id: setup.roundId, readme: "From the team" }),
    ).resolves.toMatchObject({ readme: "From the team" });
  });

  it("blocks other org members who are not on the team", async () => {
    const setup = await delegated();
    const outsider = await getPluginClient(member(setup, "not-teamed", "member"));

    const round = await outsider.getRound({ id: setup.roundId });
    expect(round.canManage).toBe(false);
    await expect(outsider.updateRoundReadme({ id: setup.roundId, readme: "Nope" })).rejects.toThrow(
      "round owner",
    );
    await expect(
      outsider.broadcastToRound({ id: setup.roundId, kind: "round_opened" }),
    ).rejects.toThrow("round owner");
  });

  it("always lets the org's owners and admins manage, without a team lookup", async () => {
    const setup = await delegated();
    authListTeamMembers.mockClear();
    const orgAdmin = await getPluginClient(member(setup, "deleg-admin-user", "admin"));
    const owner = await getPluginClient(setup.asOwner);

    expect((await orgAdmin.getRound({ id: setup.roundId })).canManage).toBe(true);
    expect((await owner.getRound({ id: setup.roundId })).canManage).toBe(true);
    expect(authListTeamMembers).not.toHaveBeenCalled();
  });

  it("fails closed when the membership lookup errors", async () => {
    const setup = await delegated();
    authListTeamMembers.mockRejectedValue(new Error("auth down"));
    const teamed = await getPluginClient(
      nearAuthedContext("teamed.near", "teamed-user", setup.orgId, "member"),
    );
    expect((await teamed.getRound({ id: setup.roundId })).canManage).toBe(false);
    await expect(teamed.updateRoundReadme({ id: setup.roundId, readme: "Nope" })).rejects.toThrow(
      "round owner",
    );
  });

  it("never grants access across organizations, even to a team member", async () => {
    const setup = await delegated();
    const otherOrg = await getPluginClient(
      nearAuthedContext("teamed.near", "teamed-user", "a-different-org", "member"),
    );
    expect((await otherOrg.getRound({ id: setup.roundId })).canManage).toBe(false);
  });

  it("returns to org-wide access once the delegation is cleared", async () => {
    const setup = await delegated();
    const owner = await getPluginClient(setup.asOwner);
    await owner.setProjectManagingTeam({ id: setup.projectId, teamId: null });

    const anyMember = await getPluginClient(member(setup, "any-member", "member"));
    expect((await anyMember.getRound({ id: setup.roundId })).canManage).toBe(true);
  });

  it("does not look up teams for projects that are not delegated", async () => {
    const setup = await projectWithRound();
    authListTeamMembers.mockClear();
    const anyMember = await getPluginClient(member(setup, "plain-member", "member"));
    expect((await anyMember.getRound({ id: setup.roundId })).canManage).toBe(true);
    expect(authListTeamMembers).not.toHaveBeenCalled();
  });
});
