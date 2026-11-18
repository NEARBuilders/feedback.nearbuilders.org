import { describe, expect, it } from "vitest";
import { describeSuggestion, snippet } from "./feedback-suggestions";

describe("describeSuggestion", () => {
  it("names a status", () => {
    expect(describeSuggestion({ status: "resolved", star: false })).toBe("resolve");
    expect(describeSuggestion({ status: "dismissed", star: false })).toBe("dismiss");
  });

  it("names a star on its own or with a status", () => {
    expect(describeSuggestion({ status: null, star: true })).toBe("star");
    expect(describeSuggestion({ status: "resolved", star: true })).toBe("resolve + star");
  });
});

describe("snippet", () => {
  it("flattens markdown and images", () => {
    expect(snippet("**Bug**\n\n![shot](https://x/y.png) it [broke](https://z)")).toBe(
      "Bug [image] it broke",
    );
  });

  it("truncates long text with an ellipsis", () => {
    const out = snippet("a".repeat(300), 50);
    expect(out).toHaveLength(50);
    expect(out.endsWith("…")).toBe(true);
  });

  it("leaves short text alone", () => {
    expect(snippet("short")).toBe("short");
  });
});
