import { describe, expect, it } from "vitest";
import { myFeedbackHref, participantPostLink, roundHref, roundParams } from "./round-links";

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

describe("participantPostLink", () => {
  const params = { slug: "near-wallet", n: "3" };

  it("is null when the participant has no posts", () => {
    expect(participantPostLink("alice.near", 0, { surface: "public", params })).toBeNull();
  });

  it("is null when no destination was given", () => {
    expect(participantPostLink("alice.near", 1)).toBeNull();
  });

  it("opens the public author-filtered feedback page", () => {
    expect(participantPostLink("alice.near", 1, { surface: "public", params })).toEqual({
      to: "/projects/$slug/$n/feedback",
      params,
      search: { author: "alice.near" },
    });
  });

  it("opens the console inbox filtered to that author", () => {
    expect(participantPostLink("alice.near", 2, { surface: "console", params })).toEqual({
      to: "/manage/$slug/$n",
      params,
      search: { status: "all", author: "alice.near" },
    });
  });
});
