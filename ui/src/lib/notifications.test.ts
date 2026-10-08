import { describe, expect, it } from "vitest";
import {
  BROADCAST_MESSAGE_MAX,
  broadcastConfirmation,
  canSendBroadcast,
  formatRelativeTime,
  formatUnreadCount,
  notificationTarget,
} from "./notifications";

describe("formatUnreadCount", () => {
  it("hides zero, shows small counts and caps large ones", () => {
    expect(formatUnreadCount(0)).toBe("");
    expect(formatUnreadCount(-2)).toBe("");
    expect(formatUnreadCount(1)).toBe("1");
    expect(formatUnreadCount(9)).toBe("9");
    expect(formatUnreadCount(10)).toBe("9+");
    expect(formatUnreadCount(250)).toBe("9+");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-06T12:00:00.000Z").getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("describes recent times in the largest whole unit", () => {
    expect(formatRelativeTime(ago(10_000), now)).toBe("just now");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe("2d ago");
  });

  it("falls back to a date after a week and treats future times as now", () => {
    expect(formatRelativeTime(ago(10 * 86_400_000), now)).not.toMatch(/ago|now/);
    expect(formatRelativeTime(new Date(now + 60_000).toISOString(), now)).toBe("just now");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatRelativeTime("not a date", now)).toBe("");
  });
});

describe("canSendBroadcast", () => {
  it("needs at least one participant", () => {
    expect(canSendBroadcast("round_opened", "", 0)).toBe(false);
    expect(canSendBroadcast("round_opened", "", 3)).toBe(true);
  });

  it("requires a non-blank message only for custom notes", () => {
    expect(canSendBroadcast("custom", "", 3)).toBe(false);
    expect(canSendBroadcast("custom", "   ", 3)).toBe(false);
    expect(canSendBroadcast("custom", "New build", 3)).toBe(true);
    expect(canSendBroadcast("round_closing", "", 3)).toBe(true);
  });

  it("rejects messages over the limit", () => {
    expect(canSendBroadcast("custom", "a".repeat(BROADCAST_MESSAGE_MAX), 1)).toBe(true);
    expect(canSendBroadcast("custom", "a".repeat(BROADCAST_MESSAGE_MAX + 1), 1)).toBe(false);
  });
});

describe("broadcastConfirmation", () => {
  it("pluralises the recipient count", () => {
    expect(broadcastConfirmation(1)).toContain("1 participant.");
    expect(broadcastConfirmation(4)).toContain("4 participants.");
  });
});

describe("notificationTarget", () => {
  it("sends feedback status updates to the tester workspace", () => {
    expect(notificationTarget("feedback_resolved")).toBe("/projects/$slug/$n/submit");
    expect(notificationTarget("feedback_dismissed")).toBe("/projects/$slug/$n/submit");
  });

  it("sends round updates to the public round page", () => {
    expect(notificationTarget("round_opened")).toBe("/projects/$slug/$n");
    expect(notificationTarget("custom")).toBe("/projects/$slug/$n");
  });
});
