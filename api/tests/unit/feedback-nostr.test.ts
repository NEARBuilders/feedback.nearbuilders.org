import { generateSecretKey, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { bytesToHex } from "nostr-tools/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedbackNostrEmitter } from "@/services/feedback-nostr";

const secretKey = generateSecretKey();
const secretKeyHex = bytesToHex(secretKey);
const pubkey = getPublicKey(secretKey);

const input = {
  projectSlug: "my-project",
  roundNumber: 3,
  format: "written" as const,
  content: "Found a bug in the onboarding flow",
  authorAccountId: "tester.near",
};

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
});

describe("createFeedbackNostrEmitter (disabled)", () => {
  it("is disabled and calls nothing when no secret key is configured", async () => {
    const nostr = vi.fn();
    const emitter = createFeedbackNostrEmitter({ nostr, logger: { warn } });

    expect(emitter.enabled).toBe(false);
    await expect(emitter.publish(input, {})).resolves.toBeNull();

    expect(nostr).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("createFeedbackNostrEmitter (enabled)", () => {
  it("signs and publishes a comment keyed like nearbuilders.org's project comments", async () => {
    const createComment = vi.fn().mockResolvedValue({ eventId: "evt_test", statuses: [] });
    const nostr = vi.fn().mockReturnValue({ createComment });
    const emitter = createFeedbackNostrEmitter({
      nostr,
      secretKeyHex,
      clientName: "feedback.nearbuilders.org",
      logger: { warn },
    });

    expect(emitter.enabled).toBe(true);
    const context = { userId: "user-1" };
    const eventId = await emitter.publish(input, context);

    expect(eventId).toBe("evt_test");
    expect(nostr).toHaveBeenCalledWith(context);
    expect(createComment).toHaveBeenCalledTimes(1);

    const call = createComment.mock.calls[0]![0];
    expect(call.target).toBe("my-project");
    expect(call.targetType).toBe("project-feedback");
    expect(call.adapterType).toBe("standard");

    const event = call.event;
    expect(event.kind).toBe(1111);
    expect(event.content).toBe(input.content);
    expect(event.pubkey).toBe(pubkey);
    expect(verifyEvent(event)).toBe(true);
    expect(event.tags).toContainEqual(["near_target", "project-feedback:my-project"]);
    expect(event.tags).toContainEqual(["near_account", "tester.near"]);
    expect(event.tags).toContainEqual(["round", "3"]);
    expect(event.tags).toContainEqual(["format", "written"]);
    expect(event.tags).toContainEqual(["t", "project-feedback"]);
    expect(event.tags).toContainEqual(["t", "feedback.nearbuilders.org"]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("swallows and logs a publish failure", async () => {
    const createComment = vi.fn().mockRejectedValue(new Error("relay unavailable"));
    const nostr = vi.fn().mockReturnValue({ createComment });
    const emitter = createFeedbackNostrEmitter({ nostr, secretKeyHex, logger: { warn } });

    await expect(emitter.publish(input, {})).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("relay unavailable");
  });
});
