import { describe, expect, it } from "vitest";
import { roundHref, roundParams } from "./round-links";

const ROUND = { projectSlug: "near-wallet", projectRoundNumber: 3 };

describe("round links", () => {
  it("builds route params from a round", () => {
    expect(roundParams(ROUND)).toEqual({ slug: "near-wallet", n: "3" });
  });

  it("builds the canonical public path", () => {
    expect(roundHref(ROUND)).toBe("/projects/near-wallet/3");
  });
});
