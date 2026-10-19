import { describe, expect, it } from "vitest";
import { formatRoundListTitle, roundListTitle } from "./round-title";

describe("roundListTitle", () => {
  it("prefixes titles that do not already start with a hash number", () => {
    expect(roundListTitle("KINU: liquidity hub on NEAR", 1)).toEqual({
      prefix: "#1",
      label: "KINU: liquidity hub on NEAR",
    });
  });

  it("does not prefix a title that already starts with #1", () => {
    expect(roundListTitle("#1 KINU: liquidity hub on NEAR", 1)).toEqual({
      prefix: null,
      label: "#1 KINU: liquidity hub on NEAR",
    });
  });

  it("does not prefix when the title has a spaced hash number", () => {
    expect(roundListTitle("# 1 KINU: liquidity hub on NEAR", 1)).toEqual({
      prefix: null,
      label: "# 1 KINU: liquidity hub on NEAR",
    });
  });

  it("does not prefix when the title already has a different hash number", () => {
    expect(roundListTitle("#2 follow-up", 1)).toEqual({
      prefix: null,
      label: "#2 follow-up",
    });
  });
});

describe("formatRoundListTitle", () => {
  it("joins the prefix and title for plain titles", () => {
    expect(formatRoundListTitle("KINU: liquidity hub on NEAR", 1)).toBe(
      "#1 KINU: liquidity hub on NEAR",
    );
  });

  it("leaves an already-numbered title alone", () => {
    expect(formatRoundListTitle("#1 KINU: liquidity hub on NEAR", 1)).toBe(
      "#1 KINU: liquidity hub on NEAR",
    );
  });
});
