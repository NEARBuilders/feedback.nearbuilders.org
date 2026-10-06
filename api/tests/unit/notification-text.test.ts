import { describe, expect, it } from "vitest";
import { notificationText } from "@/services/notification-text";
import { chunk } from "@/services/notifications";

describe("notificationText", () => {
  it("uses a default body for the lifecycle presets", () => {
    expect(notificationText("round_opened", "Onboarding")).toEqual({
      title: "Round opened: Onboarding",
      body: "The round is open. Join in and share your feedback.",
    });
    expect(notificationText("round_closing", "Onboarding").title).toBe("Closing soon: Onboarding");
    expect(notificationText("round_closed", "Onboarding").title).toBe("Round closed: Onboarding");
  });

  it("lets a message replace the preset body", () => {
    expect(notificationText("round_closing", "Onboarding", "  Two days left  ").body).toBe(
      "Two days left",
    );
  });

  it("falls back to the preset body for a blank message", () => {
    expect(notificationText("round_opened", "Onboarding", "   ").body).toContain("round is open");
  });

  it("builds a custom update from the message alone", () => {
    expect(notificationText("custom", "Onboarding", "New build is live")).toEqual({
      title: "Update on Onboarding",
      body: "New build is live",
    });
  });
});

describe("chunk", () => {
  it("splits a list into batches of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("returns no batches for an empty list", () => {
    expect(chunk([], 500)).toEqual([]);
  });
});
