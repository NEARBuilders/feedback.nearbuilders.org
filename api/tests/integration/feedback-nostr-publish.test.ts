import { verifyEvent } from "nostr-tools/pure";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPluginClient, nearAuthedContext, nostrCreateComment } from "../setup";

const baseInput = {
  projectSlug: "nostr-project",
  title: "Nostr publish check",
  description: "Confirms feedback goes out over the composed nostr plugin.",
  formats: ["written" as const, "recorded" as const],
};

beforeEach(() => {
  nostrCreateComment.mockClear();
});

describe("postFeedback (nostr plugin composition)", () => {
  it("publishes through the runtime-composed nostr client, not just the emitter unit", async () => {
    const owner = await getPluginClient(nearAuthedContext("nostr-owner.near"));
    const round = await owner.createRound(baseInput);

    const builder = await getPluginClient(nearAuthedContext("nostr-builder.near"));
    await builder.joinRound({ id: round.id });
    const feedback = await builder.postFeedback({
      id: round.id,
      format: "written",
      body: "Found a bug in the onboarding flow",
    });

    expect(feedback.nostrEventId).toBe("test-nostr-event");
    expect(nostrCreateComment).toHaveBeenCalledTimes(1);

    const call = nostrCreateComment.mock.calls[0]![0];
    expect(call.target).toBe(round.projectSlug);
    expect(call.targetType).toBe("project-feedback");
    expect(verifyEvent(call.event)).toBe(true);
    expect(call.event.content).toBe("Found a bug in the onboarding flow");
    expect(call.event.tags).toContainEqual([
      "near_target",
      `project-feedback:${round.projectSlug}`,
    ]);
    expect(call.event.tags).toContainEqual(["near_account", "nostr-builder.near"]);
    expect(call.event.tags).toContainEqual(["round", String(round.projectRoundNumber)]);
    expect(call.event.tags).toContainEqual(["format", "written"]);
  });

  it("keeps Postgres as the read path: listFeedback works even if the nostr publish fails", async () => {
    nostrCreateComment.mockRejectedValueOnce(new Error("relay unavailable"));

    const owner = await getPluginClient(nearAuthedContext("nostr-owner-2.near"));
    const round = await owner.createRound({ ...baseInput, projectSlug: "nostr-project-2" });

    const builder = await getPluginClient(nearAuthedContext("nostr-builder-2.near"));
    await builder.joinRound({ id: round.id });
    const feedback = await builder.postFeedback({
      id: round.id,
      format: "written",
      body: "Still lands in Postgres",
    });

    expect(feedback.nostrEventId).toBeNull();

    const anon = await getPluginClient();
    const thread = await anon.listFeedback({ id: round.id });
    expect(thread.find((entry) => entry.id === feedback.id)?.body).toBe("Still lands in Postgres");
  });
});

describe("deleteFeedback (nostr comments can't be retracted)", () => {
  it("warns instead of silently leaving a stale Nostr comment behind", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const owner = await getPluginClient(nearAuthedContext("nostr-del-owner.near"));
      const round = await owner.createRound({ ...baseInput, projectSlug: "nostr-del-project" });

      const builder = await getPluginClient(nearAuthedContext("nostr-del-builder.near"));
      await builder.joinRound({ id: round.id });
      const feedback = await builder.postFeedback({
        id: round.id,
        format: "written",
        body: "Will be deleted",
      });
      expect(feedback.nostrEventId).toBe("test-nostr-event");

      warn.mockClear();
      await owner.deleteFeedback({ id: round.id, feedbackId: feedback.id });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(feedback.nostrEventId);
      expect(String(warn.mock.calls[0]?.[0])).toContain("can't be retracted");
    } finally {
      warn.mockRestore();
    }
  });

  it("stays quiet when the deleted feedback never published to Nostr", async () => {
    nostrCreateComment.mockRejectedValueOnce(new Error("relay unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const owner = await getPluginClient(nearAuthedContext("nostr-del-owner-2.near"));
      const round = await owner.createRound({ ...baseInput, projectSlug: "nostr-del-project-2" });

      const builder = await getPluginClient(nearAuthedContext("nostr-del-builder-2.near"));
      await builder.joinRound({ id: round.id });
      const feedback = await builder.postFeedback({
        id: round.id,
        format: "written",
        body: "Never made it to Nostr",
      });
      expect(feedback.nostrEventId).toBeNull();

      warn.mockClear();
      await owner.deleteFeedback({ id: round.id, feedbackId: feedback.id });

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
