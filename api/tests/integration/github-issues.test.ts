import { beforeEach, describe, expect, it } from "vitest";
import {
  adminContext,
  authListTeamMembers,
  authListTeams,
  getPluginClient,
  nearAuthedContext,
} from "../setup";

let privateRoundCounter = 0;

async function createPrivateIssuesRound() {
  const n = ++privateRoundCounter;
  const orgId = `github-private-org-${n}`;
  const ownerContext = nearAuthedContext(
    `github-private-owner-${n}.near`,
    `github-private-owner-user-${n}`,
    orgId,
    "owner",
  );
  const owner = await getPluginClient(ownerContext);
  const round = await owner.createRound({
    projectSlug: `github-private-project-${n}`,
    title: `Private GitHub issues ${n}`,
    description: "Private GitHub issue lookup authorization.",
    formats: ["issues"],
    repoUrl: "https://example.com/near/private-feedback",
    isPrivate: true,
  });

  if (round.status !== "open") {
    const admin = await getPluginClient(adminContext());
    await admin.approveProject({ id: round.projectRecordId });
  }

  return { orgId, owner, round };
}

describe("getRoundGithubIssues", () => {
  beforeEach(() => {
    authListTeams.mockReset();
    authListTeamMembers.mockReset();
    authListTeams.mockResolvedValue([{ id: "github-issues-team" }]);
    authListTeamMembers.mockResolvedValue([{ userId: "github-team-member" }]);
  });

  it("404s for a round that doesn't exist", async () => {
    const client = await getPluginClient();
    await expect(
      client.getRoundGithubIssues({ id: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toThrow();
  });

  it("rejects a round that isn't collecting GitHub issues", async () => {
    const owner = await getPluginClient(nearAuthedContext("github-issues-owner.near"));
    const round = await owner.createRound({
      projectSlug: "no-issues-project",
      title: "Written feedback only",
      description: "No GitHub issues collected on this round.",
      formats: ["written"],
    });

    const anon = await getPluginClient();
    await expect(anon.getRoundGithubIssues({ id: round.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("is public and needs no authentication for a round that does collect issues", async () => {
    const owner = await getPluginClient(nearAuthedContext("github-issues-owner-2.near"));
    // Not a github.com URL: exercises the route wiring (auth, lookup, window
    // fields) without making a live call out to the real GitHub API, since
    // the lookup's own unit tests (tests/unit/github-issues.test.ts) already
    // cover what happens once a repo is actually reachable.
    const round = await owner.createRound({
      projectSlug: "issues-project",
      title: "File issues against our repo",
      description: "Break it and tell us on GitHub.",
      formats: ["issues"],
      repoUrl: "https://example.com/near/feedback",
    });

    const anon = await getPluginClient();
    const result = await anon.getRoundGithubIssues({ id: round.id });

    expect(result.repoUrl).toBe("https://example.com/near/feedback");
    expect(result.windowStart).toEqual(round.createdAt);
    expect(result.windowEnd).toBeNull();
    expect(result.contributors).toEqual([]);
  });

  it("restricts private rounds to managers, delegated team members, and admins", async () => {
    const { orgId, owner, round } = await createPrivateIssuesRound();

    const anon = await getPluginClient();
    await expect(anon.getRoundGithubIssues({ id: round.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const unrelated = await getPluginClient(nearAuthedContext("github-unrelated.near"));
    await expect(unrelated.getRoundGithubIssues({ id: round.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(owner.getRoundGithubIssues({ id: round.id })).resolves.toMatchObject({
      repoUrl: round.repoUrl,
      contributors: [],
    });

    await owner.setProjectManagingTeam({
      id: round.projectRecordId,
      teamId: "github-issues-team",
    });
    const delegated = await getPluginClient(
      nearAuthedContext("github-team-member.near", "github-team-member", orgId, "member"),
    );
    await expect(delegated.getRoundGithubIssues({ id: round.id })).resolves.toMatchObject({
      repoUrl: round.repoUrl,
      contributors: [],
    });

    const admin = await getPluginClient(adminContext());
    await expect(admin.getRoundGithubIssues({ id: round.id })).resolves.toMatchObject({
      repoUrl: round.repoUrl,
      contributors: [],
    });
  });
});
