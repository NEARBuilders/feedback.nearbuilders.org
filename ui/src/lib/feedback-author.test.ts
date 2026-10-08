import { describe, expect, it } from "vitest";
import { ANONYMOUS_LABEL, authorLabel } from "./feedback-author";

describe("authorLabel (#89)", () => {
  it("shows the account, or Anonymous when the submission has none", () => {
    expect(authorLabel({ authorAccountId: "alice.near" })).toBe("alice.near");
    expect(authorLabel({ authorAccountId: null })).toBe(ANONYMOUS_LABEL);
    expect(ANONYMOUS_LABEL).toBe("Anonymous");
  });
});
