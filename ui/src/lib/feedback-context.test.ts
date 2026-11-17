import { describe, expect, it } from "vitest";
import {
  appendContext,
  contextFromSearch,
  formatContextFooter,
  hasContext,
  sanitizeBrowser,
  sanitizePageUrl,
  sanitizeViewport,
} from "./feedback-context";

describe("sanitizePageUrl", () => {
  it("keeps origin and path and drops the query and hash", () => {
    expect(sanitizePageUrl("https://app.example.com/a/b?token=secret#frag")).toBe(
      "https://app.example.com/a/b",
    );
  });

  it("rejects non-http schemes and junk", () => {
    expect(sanitizePageUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizePageUrl("data:text/html,hi")).toBeUndefined();
    expect(sanitizePageUrl("not a url")).toBeUndefined();
    expect(sanitizePageUrl(undefined)).toBeUndefined();
  });

  it("rejects very long addresses", () => {
    expect(sanitizePageUrl(`https://example.com/${"a".repeat(400)}`)).toBeUndefined();
  });
});

describe("sanitizeViewport", () => {
  it("formats a width and height", () => {
    expect(sanitizeViewport("1440x900")).toBe("1440 × 900");
  });

  it("rejects anything else", () => {
    expect(sanitizeViewport("big")).toBeUndefined();
    expect(sanitizeViewport("1440x900x2")).toBeUndefined();
    expect(sanitizeViewport("1x1")).toBeUndefined();
  });
});

describe("sanitizeBrowser", () => {
  it("strips backticks and non-printable characters", () => {
    expect(sanitizeBrowser("Mozilla/5.0 `evil` \u0007 ok")).toBe("Mozilla/5.0 evil  ok");
  });

  it("truncates long strings", () => {
    expect(sanitizeBrowser("x".repeat(500))).toHaveLength(200);
  });

  it("returns nothing for an empty result", () => {
    expect(sanitizeBrowser("   ")).toBeUndefined();
  });
});

describe("formatContextFooter / appendContext", () => {
  const context = {
    pageUrl: "https://app.example.com/pricing",
    browser: "Mozilla/5.0",
    viewport: "1440 × 900",
  };

  it("builds a markdown footer after a horizontal rule", () => {
    const footer = formatContextFooter(context);
    expect(footer.startsWith("\n\n---\n\n**Page details**")).toBe(true);
    expect(footer).toContain("- Page: <https://app.example.com/pricing>");
    expect(footer).toContain("- Browser: `Mozilla/5.0`");
    expect(footer).toContain("- Viewport: 1440 × 900");
  });

  it("leaves the body untouched when there is nothing to add", () => {
    expect(appendContext("hello", undefined)).toBe("hello");
    expect(appendContext("hello", {})).toBe("hello");
  });

  it("appends to the body", () => {
    expect(appendContext("it broke", context).startsWith("it broke\n\n---")).toBe(true);
  });
});

describe("contextFromSearch", () => {
  it("sanitizes what the launcher passes in", () => {
    expect(contextFromSearch({ from: "https://a.example/x?y=1", vp: "375x812" })).toEqual({
      pageUrl: "https://a.example/x",
      viewport: "375 × 812",
    });
  });

  it("ignores bad values", () => {
    const context = contextFromSearch({ from: "javascript:1", vp: "nope" });
    expect(hasContext(context)).toBe(false);
  });
});
