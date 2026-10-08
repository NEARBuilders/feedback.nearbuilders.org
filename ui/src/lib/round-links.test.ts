import { describe, expect, it } from "vitest";
import { myFeedbackHref, roundHref, roundParams } from "./round-links";

const ROUND = { projectSlug: "near-wallet", projectRoundNumber: 3 };

describe("round links", () => {
  it("builds route params from a round", () => {
    expect(roundParams(ROUND)).toEqual({ slug: "near-wallet", n: "3" });
  });

  it("builds the canonical public path", () => {
    expect(roundHref(ROUND)).toBe("/projects/near-wallet/3");
  });

  it("builds the author-filtered feedback link", () => {
    expect(myFeedbackHref(ROUND, "alice.near")).toBe(
      "/projects/near-wallet/3/feedback?author=alice.near",
    );
  });

  it("encodes the author safely", () => {
    expect(myFeedbackHref(ROUND, "a/b near")).toBe(
      "/projects/near-wallet/3/feedback?author=a%2Fb%20near",
    );
  });
});
