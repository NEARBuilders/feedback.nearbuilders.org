import { describe, expect, it } from "vitest";
import { adminContext, getPluginClient, nearAuthedContext } from "../setup";

describe("core journey: join, post, resolve, close (#324)", () => {
  it("takes a round from open to closed with the tester seeing each step", async () => {
    const owner = await getPluginClient(nearAuthedContext("journey-owner.near"));
    const created = await owner.createRound({
      isPrivate: false,
      projectSlug: "journey-project",
      title: "Journey round",
      description: "Walk the whole path.",
      formats: ["written"],
    });
    if (created.status !== "open") {
      const admin = await getPluginClient(adminContext());
      await admin.approveProject({ id: created.projectRecordId });
    }
    const roundId = created.id;

    const tester = await getPluginClient(nearAuthedContext("journey-tester.near"));
    await tester.joinRound({ id: roundId });

    const posted = await tester.postFeedback({
      id: roundId,
      format: "written",
      body: "The save button does nothing on the second click.",
    });
    expect(posted.status).toBe("unresolved");

    const inbox = await owner.listFeedback({ id: roundId });
    expect(inbox.items.map((item) => item.id)).toContain(posted.id);

    await owner.setFeedbackStatus({ id: roundId, feedbackIds: [posted.id], status: "resolved" });

    const mine = await tester.listMyFeedback({ id: roundId });
    expect(mine.find((item) => item.id === posted.id)?.status).toBe("resolved");

    const { items } = await tester.listNotifications({});
    expect(items.some((item) => item.kind === "feedback_resolved")).toBe(true);

    const closed = await owner.closeRound({
      id: roundId,
      credits: [{ builderAccountId: "journey-tester.near", contributedMeaningfully: true }],
    });
    expect(closed.status).toBe("closed");

    await expect(
      tester.postFeedback({ id: roundId, format: "written", body: "Too late" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
