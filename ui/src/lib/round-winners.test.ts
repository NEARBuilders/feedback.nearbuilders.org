import { describe, expect, it } from "vitest";
import { parseWinnersInput } from "./round-winners";

describe("parseWinnersInput", () => {
  it("keeps the owner's order, trims, and drops blanks and duplicates", () => {
    expect(parseWinnersInput(" alice.near\n\nbob.tg , alice.near\ncarol.near ")).toEqual([
      "alice.near",
      "bob.tg",
      "carol.near",
    ]);
  });

  it("lowercases so case variants collapse into one rank", () => {
    expect(parseWinnersInput("Alice.near\nalice.NEAR")).toEqual(["alice.near"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseWinnersInput("  \n ")).toEqual([]);
  });
});
