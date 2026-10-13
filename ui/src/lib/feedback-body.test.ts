import { describe, expect, it } from "vitest";
import { feedbackTextLength, hasUnuploadedImage } from "./feedback-body";

const url = `https://cdn.test/uploads/${"a".repeat(150)}.png`;

describe("feedbackTextLength", () => {
  it("counts plain text as is", () => {
    expect(feedbackTextLength("hello world")).toBe(11);
  });

  it("doesn't count images, even with file-name alt text", () => {
    expect(feedbackTextLength(`before\n\n![Screenshot 2026-10-10.png](${url})\n\nafter`)).toBe(
      "before\n\nafter".length - 1,
    );
    expect(feedbackTextLength(`![shot](<${url}> "title")`)).toBe(0);
  });

  it("counts a link as its text only", () => {
    expect(feedbackTextLength(`see [the docs](${url})`)).toBe("see the docs".length);
    expect(feedbackTextLength("<https://y.test/z>")).toBe("https://y.test/z".length);
  });

  it("doesn't count markdown syntax", () => {
    expect(feedbackTextLength("## Title")).toBe(5);
    expect(feedbackTextLength("- one\n- two")).toBe("one\ntwo".length);
    expect(feedbackTextLength("> quoted **bold** `code` ~~gone~~")).toBe(
      "quoted bold code gone".length,
    );
    expect(feedbackTextLength("1\\. not a list \\*")).toBe("1. not a list *".length);
    expect(feedbackTextLength("```ts\nconst a = 1;\n```")).toBe("const a = 1;".length);
    expect(feedbackTextLength("a\n\n&nbsp;\n\nb")).toBe("a\n \nb".length);
  });
});

describe("hasUnuploadedImage", () => {
  it("flags images still embedded as file data", () => {
    expect(hasUnuploadedImage("a\n\n![shot.png](data:image/png;base64,iVBORw0KGgo=)")).toBe(true);
    expect(hasUnuploadedImage("![shot.png](blob:https://x.test/123)")).toBe(true);
  });

  it("accepts uploaded images and plain text", () => {
    expect(hasUnuploadedImage(`![shot.png](${url})`)).toBe(false);
    expect(hasUnuploadedImage("data: not an image")).toBe(false);
  });
});
