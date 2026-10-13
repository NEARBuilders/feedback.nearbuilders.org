import { describe, expect, it } from "vitest";
import { canSaveFeedbackEdit, isOwnFeedback } from "./feedback-edit";

describe("isOwnFeedback", () => {
  it("matches any linked wallet, not only the active one", () => {
    expect(isOwnFeedback("ballzz.near", ["misbaahansari.near"])).toBe(false);
    expect(isOwnFeedback("ballzz.near", ["misbaahansari.near", "ballzz.near"])).toBe(true);
  });
});

describe("canSaveFeedbackEdit", () => {
  it("allows saving already-submitted written feedback", () => {
    expect(
      canSaveFeedbackEdit({
        draft: "The onboarding flow dropped me after wallet connect.",
        format: "written",
        pendingUploads: 0,
        isPending: false,
      }),
    ).toBe(true);
  });

  it("blocks an empty draft, a pending upload, or an in-flight save", () => {
    const base = {
      draft: "keep me",
      format: "written" as const,
      pendingUploads: 0,
      isPending: false,
    };
    expect(canSaveFeedbackEdit({ ...base, draft: "   " })).toBe(false);
    expect(canSaveFeedbackEdit({ ...base, pendingUploads: 1 })).toBe(false);
    expect(canSaveFeedbackEdit({ ...base, isPending: true })).toBe(false);
  });

  it("blocks written drafts that still embed file data", () => {
    expect(
      canSaveFeedbackEdit({
        draft: "shot\n\n![x](data:image/png;base64,abcd)",
        format: "written",
        pendingUploads: 0,
        isPending: false,
      }),
    ).toBe(false);
  });
});
