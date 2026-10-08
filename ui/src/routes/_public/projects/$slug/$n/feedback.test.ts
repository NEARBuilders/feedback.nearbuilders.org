import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { feedbackEmptyTitle, validateFeedbackSearch } = await import("./feedback");

describe("feedback tab search params", () => {
  it("has no author filter by default", () => {
    expect(validateFeedbackSearch({} as never)).toEqual({ author: undefined });
  });

  it("keeps a valid author and drops junk", () => {
    expect(validateFeedbackSearch({ author: "alice.near" } as never)).toEqual({
      author: "alice.near",
    });
    expect(validateFeedbackSearch({ author: "" } as never)).toEqual({ author: undefined });
    expect(validateFeedbackSearch({ author: 123 } as never)).toEqual({ author: undefined });
  });
});

describe("feedbackEmptyTitle", () => {
  const base = {
    isPrivate: true,
    canReadAll: false,
    viewerAccountId: "alice.near",
    feedbackCount: 3,
  };

  it("tells a non-manager who visits someone else's link what they can see", () => {
    expect(feedbackEmptyTitle({ ...base, author: "bob.near" })).toBe(
      "This feedback is only visible to the round organizers and its author.",
    );
  });

  it("tells an author their own submissions are empty", () => {
    expect(feedbackEmptyTitle({ ...base, author: "alice.near" })).toBe(
      "You haven't posted any feedback here.",
    );
  });

  it("is direct about an empty author filter for readers", () => {
    expect(feedbackEmptyTitle({ ...base, canReadAll: true, author: "bob.near" })).toBe(
      "No feedback by bob.near yet.",
    );
    expect(feedbackEmptyTitle({ ...base, isPrivate: false, author: "bob.near" })).toBe(
      "No feedback by bob.near yet.",
    );
  });

  it("keeps the unfiltered private copy", () => {
    expect(feedbackEmptyTitle({ ...base, author: undefined })).toBe(
      "You haven't posted any feedback here.",
    );
    expect(feedbackEmptyTitle({ ...base, author: undefined, feedbackCount: 0 })).toBe(
      "No feedback yet.",
    );
  });
});
