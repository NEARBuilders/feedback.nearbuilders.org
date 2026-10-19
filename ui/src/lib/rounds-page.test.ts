import { describe, expect, it } from "vitest";
import { clampRoundsPage } from "./rounds-page";

describe("clampRoundsPage", () => {
  it("keeps a page that has rows", () => {
    expect(clampRoundsPage(11, 1)).toBe(1);
    expect(clampRoundsPage(11, 2)).toBe(2);
  });

  it("moves a page past the end back to the last page with rows", () => {
    expect(clampRoundsPage(11, 99)).toBe(2);
    expect(clampRoundsPage(2, 99)).toBe(1);
  });

  it("treats an empty list as a single page", () => {
    expect(clampRoundsPage(0, 99)).toBe(1);
  });
});
