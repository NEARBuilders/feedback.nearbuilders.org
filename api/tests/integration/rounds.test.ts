import { describe, expect, it } from "vitest";
import { authedContext, getPluginClient, nearAuthedContext } from "../setup";

const baseInput = {
  projectSlug: "my-project",
  title: "Try the new onboarding flow",
  description: "Walk through signup and tell us where you got stuck.",
  formats: ["written" as const],
};

describe("createRound", () => {
  it("rejects unauthenticated requests", async () => {
    const client = await getPluginClient();
    await expect(client.createRound(baseInput)).rejects.toThrow("Authentication required");
  });

  it("rejects a signed-in user with no linked NEAR account", async () => {
    const client = await getPluginClient(authedContext());
    await expect(client.createRound(baseInput)).rejects.toThrow(
      "Link a NEAR account before requesting a feedback round",
    );
  });

  it("creates a round as open immediately, no approval step", async () => {
    const client = await getPluginClient(nearAuthedContext("owner.near"));
    const round = await client.createRound(baseInput);

    expect(round).toMatchObject({
      ownerAccountId: "owner.near",
      projectSlug: "my-project",
      title: baseInput.title,
      description: baseInput.description,
      formats: ["written"],
      repoUrl: null,
      status: "open",
    });
    expect(round.id).toEqual(expect.any(String));
    expect(round.closedAt).toBeNull();
  });

  it("rejects a round with no formats selected", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...baseInput, formats: [] })).rejects.toThrow();
  });

  it("rejects the issues format without a repo URL", async () => {
    const client = await getPluginClient(nearAuthedContext());
    await expect(client.createRound({ ...baseInput, formats: ["issues"] })).rejects.toThrow();
  });

  it("accepts the issues format when a repo URL is provided", async () => {
    const client = await getPluginClient(nearAuthedContext());
    const round = await client.createRound({
      ...baseInput,
      formats: ["issues"],
      repoUrl: "https://github.com/near/feedback",
    });
    expect(round.repoUrl).toBe("https://github.com/near/feedback");
  });
});

describe("getRound", () => {
  it("returns a round that exists", async () => {
    const owner = await getPluginClient(nearAuthedContext("reader-owner.near"));
    const created = await owner.createRound(baseInput);

    const anon = await getPluginClient();
    const fetched = await anon.getRound({ id: created.id });
    expect(fetched.id).toBe(created.id);
  });

  it("fails with NOT_FOUND for an unknown id", async () => {
    const client = await getPluginClient();
    await expect(client.getRound({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});
