import { describe, expect, it } from "vitest";
import { getPluginClient, nearAuthedContext } from "../setup";

describe("getRoundGithubIssues", () => {
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
    await expect(anon.getRoundGithubIssues({ id: round.id })).rejects.toThrow(
      "This round isn't collecting GitHub issues",
    );
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
});
