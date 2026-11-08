import { describe, expect, it } from "vitest";
import { clientFor, createOpenRound, freshSlug } from "../fixtures";
import { adminContext, getPluginClient } from "../setup";

describe("getProjectStatus (#239)", () => {
  it("reports a pending project to anonymous callers without its private details", async () => {
    const owner = await clientFor("status-owner1.near");
    const pending = await owner.createRound({
      projectSlug: freshSlug("status-pending"),
      title: "Secret launch plan",
      description: "Not approved yet",
      formats: ["written"],
      contact: "requester@example.com",
    });
    const anon = await getPluginClient();

    const status = await anon.getProjectStatus({ slug: pending.projectSlug });

    expect(status).toEqual({ status: "pending", openRounds: 0 });
    const body = JSON.stringify(status);
    expect(body).not.toContain("requester@example.com");
    expect(body).not.toContain("Secret launch plan");
  });

  it("reports an approved project with its open round count", async () => {
    const slug = freshSlug("status-approved");
    const { ownerClient, round } = await createOpenRound("status-owner2.near", {
      projectSlug: slug,
    });
    const anon = await getPluginClient();

    await expect(anon.getProjectStatus({ slug })).resolves.toEqual({
      status: "approved",
      openRounds: 1,
    });

    await ownerClient.closeRound({ id: round.id });
    await expect(anon.getProjectStatus({ slug })).resolves.toEqual({
      status: "approved",
      openRounds: 0,
    });
  });

  it("leaves expired rounds out of the open round count", async () => {
    const slug = freshSlug("status-expired");
    const { ownerClient, round } = await createOpenRound("status-owner4.near", {
      projectSlug: slug,
    });
    await ownerClient.updateRoundSettings({
      id: round.id,
      endsAt: new Date(Date.now() - 1_000).toISOString(),
    });

    await expect((await getPluginClient()).getProjectStatus({ slug })).resolves.toEqual({
      status: "approved",
      openRounds: 0,
    });
  });

  it("reports a rejected project", async () => {
    const owner = await clientFor("status-owner3.near");
    const round = await owner.createRound({
      projectSlug: freshSlug("status-rejected"),
      title: "Rejected",
      description: "Will be rejected",
      formats: ["written"],
    });
    const admin = await getPluginClient(adminContext());
    await admin.rejectProject({ id: round.projectRecordId, reason: "Out of scope" });

    const status = await (await getPluginClient()).getProjectStatus({ slug: round.projectSlug });

    expect(status).toEqual({ status: "rejected", openRounds: 0 });
    expect(JSON.stringify(status)).not.toContain("Out of scope");
  });

  it("returns NOT_FOUND for an unknown slug", async () => {
    await expect(
      (await getPluginClient()).getProjectStatus({ slug: "no-such-project" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
