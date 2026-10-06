import { describe, expect, it } from "vitest";
import { parseRoundNumber, roundHref, roundParams } from "./round-links";

const ROUND = { projectSlug: "near-wallet", projectRoundNumber: 3 };

describe("round links", () => {
  it("builds route params from a round", () => {
    expect(roundParams(ROUND)).toEqual({ slug: "near-wallet", n: "3" });
  });

  it("builds the canonical public path", () => {
    expect(roundHref(ROUND)).toBe("/projects/near-wallet/3");
  });

  it("parses positive integer round numbers only", () => {
    expect(parseRoundNumber("3")).toBe(3);
    expect(parseRoundNumber("0")).toBeNull();
    expect(parseRoundNumber("2.5")).toBeNull();
    expect(parseRoundNumber("abc")).toBeNull();
  });
});
