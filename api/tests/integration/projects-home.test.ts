import { describe, expect, it } from "vitest";
import { clientFor, createOpenRound, freshSlug, joinWithFeedback } from "../fixtures";
import { getPluginClient } from "../setup";

describe("listPublicProjects (#119)", () => {
  it("lists approved projects with their public rounds grouped beneath", async () => {
    const slug = freshSlug("home-approved");
    const { round, ownerClient } = await createOpenRound("home-owner1.near", { projectSlug: slug });
    await ownerClient.closeRound({ id: round.id });
    await ownerClient.createRound({
      projectSlug: slug,
      title: "Round two",
      description: "Again",
      formats: ["written"],
    });
    const pending = freshSlug("home-pending");
    await ownerClient.createRound({
      projectSlug: pending,
      title: "Pending",
      description: "Not approved",
      formats: ["written"],
    });

    const projects = await (await getPluginClient()).listPublicProjects({});
    const project = projects.find((p) => p.slug === slug);
    expect(project?.rounds.map((r) => [r.projectRoundNumber, r.status])).toEqual([
      [1, "closed"],
      [2, "open"],
    ]);
    expect(projects.some((p) => p.slug === pending)).toBe(false);
  });
});

describe("getProjectBySlug (#119)", () => {
  it("returns the project, its rounds and whether the viewer manages it", async () => {
    const slug = freshSlug("home-detail");
    const { ownerClient } = await createOpenRound("home-owner2.near", { projectSlug: slug });

    const asOwner = await ownerClient.getProjectBySlug({ slug });
    expect(asOwner).toMatchObject({ slug, canManage: true, identity: null });
    expect(asOwner.rounds).toHaveLength(1);

    const asVisitor = await (await getPluginClient()).getProjectBySlug({ slug });
    expect(asVisitor.canManage).toBe(false);
  });

  it("hides unknown and unapproved projects from visitors", async () => {
    const owner = await clientFor("home-owner3.near");
    const pending = await owner.createRound({
      projectSlug: freshSlug("home-hidden"),
      title: "Pending",
      description: "Not approved",
      formats: ["written"],
    });
    const anon = await getPluginClient();
    await expect(anon.getProjectBySlug({ slug: pending.projectSlug })).rejects.toThrow(
      "Project not found",
    );
    await expect(anon.getProjectBySlug({ slug: "no-such-project" })).rejects.toThrow(
      "Project not found",
    );
    await expect(owner.getProjectBySlug({ slug: pending.projectSlug })).resolves.toMatchObject({
      status: "pending",
    });
  });
});

describe("inviteTesters (#119)", () => {
  it("invites the previous round's testers who haven't joined yet", async () => {
    const slug = freshSlug("home-invite");
    const { round: first, ownerClient } = await createOpenRound("home-owner4.near", {
      projectSlug: slug,
    });
    await joinWithFeedback(first.id, "home-a4.near");
    await joinWithFeedback(first.id, "home-b4.near");
    const next = await ownerClient.createRound({
      projectSlug: slug,
      title: "Round two",
      description: "Again",
      formats: ["written"],
    });
    await joinWithFeedback(next.id, "home-b4.near");

    const result = await ownerClient.inviteTesters({ id: next.id, fromRoundId: first.id });
    expect(result).toEqual({ recipients: 1 });

    const { items } = await (await clientFor("home-a4.near")).listNotifications({});
    expect(items[0]).toMatchObject({ kind: "round_opened", roundId: next.id });
  });

  it("only lets the round's managers invite, from the same project", async () => {
    const { round: other } = await createOpenRound("home-owner5.near");
    const { round, ownerClient } = await createOpenRound("home-owner5.near");
    await expect(
      ownerClient.inviteTesters({ id: round.id, fromRoundId: other.id }),
    ).rejects.toThrow("same project");
    const stranger = await clientFor("home-stranger5.near");
    await expect(stranger.inviteTesters({ id: round.id, fromRoundId: round.id })).rejects.toThrow(
      "round owner",
    );
  });
});
