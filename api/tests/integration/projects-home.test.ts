import { describe, expect, it } from "vitest";
import { PublicProjectOmittedFields } from "../../src/contract";
import { clientFor, createOpenRound, freshSlug, joinWithFeedback } from "../fixtures";
import { getPluginClient } from "../setup";

describe("listPublicProjects (#119)", () => {
  it("does not expose contact or administrative project metadata", async () => {
    const slug = freshSlug("home-public-safe");
    const ownerClient = await clientFor("home-public-safe-owner.near");
    const round = await ownerClient.createRound({
      projectSlug: slug,
      title: "Public project",
      description: "Public description",
      formats: ["written"],
      contact: "requester@example.com",
    });
    if (round.status !== "open") {
      await (await getPluginClient()).approveProject({ id: round.projectRecordId });
    }

    const anonymous = await getPluginClient();
    const projects = await anonymous.listPublicProjects();
    const project = projects.find((item) => item.slug === slug);
    expect(project).toBeDefined();
    expect(project).toMatchObject({ id: expect.any(String), slug, name: "Public project" });
    for (const field of Object.keys(PublicProjectOmittedFields)) {
      expect(project).not.toHaveProperty(field);
    }
  });

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

    const projects = await (await getPluginClient()).listPublicProjects();
    const project = projects.find((p) => p.slug === slug);
    expect(project?.rounds.map((r) => [r.projectRoundNumber, r.status])).toEqual([
      [1, "closed"],
      [2, "open"],
    ]);
    expect(projects.some((p) => p.slug === pending)).toBe(false);
  });
});

describe("getProjectBySlug (#119)", () => {
  it("does not expose contact or administrative project metadata publicly", async () => {
    const slug = freshSlug("home-detail-safe");
    const ownerClient = await clientFor("home-detail-safe-owner.near");
    const round = await ownerClient.createRound({
      projectSlug: slug,
      title: "Public project",
      description: "Public description",
      formats: ["written"],
      contact: "@requester",
    });
    if (round.status !== "open") {
      await (await getPluginClient()).approveProject({ id: round.projectRecordId });
    }

    const anonymous = await getPluginClient();
    const project = await anonymous.getProjectBySlug({ slug });
    expect(project).toMatchObject({ id: expect.any(String), slug, name: "Public project" });
    for (const field of Object.keys(PublicProjectOmittedFields)) {
      expect(project).not.toHaveProperty(field);
    }
  });

  it("keeps the complete project record on the authorized management route", async () => {
    const slug = freshSlug("home-managed-detail");
    const ownerClient = await clientFor("home-managed-detail-owner.near");
    const round = await ownerClient.createRound({
      projectSlug: slug,
      title: "Managed project",
      description: "Managed description",
      formats: ["written"],
      contact: "manager@example.com",
    });
    if (round.status !== "open") {
      await (await getPluginClient()).approveProject({ id: round.projectRecordId });
    }

    const managed = await ownerClient.getManagedProjectBySlug({ slug });
    expect(managed).toMatchObject({
      contact: "manager@example.com",
      canManage: true,
    });
    for (const field of Object.keys(PublicProjectOmittedFields)) {
      expect(managed).toHaveProperty(field);
    }
  });

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
    await expect(anon.getProjectBySlug({ slug: pending.projectSlug })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(anon.getProjectBySlug({ slug: "no-such-project" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const stranger = await clientFor("home-stranger5.near");
    await expect(
      stranger.inviteTesters({ id: round.id, fromRoundId: round.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
