import { describe, expect, it } from "vitest";
import { composeGuidedReport, EMPTY_GUIDED_ANSWERS, isGuidedComplete } from "./guided-feedback";

describe("isGuidedComplete", () => {
  it("needs what happened", () => {
    expect(isGuidedComplete(EMPTY_GUIDED_ANSWERS)).toBe(false);
    expect(isGuidedComplete({ goal: "Send tokens", actual: "   ", expected: "" })).toBe(false);
    expect(isGuidedComplete({ goal: "", actual: "It froze", expected: "" })).toBe(true);
  });
});

describe("composeGuidedReport", () => {
  it("builds a section per answered question, in order", () => {
    const report = composeGuidedReport({
      goal: "Send tokens",
      actual: "The page froze",
      expected: "A confirmation",
    });
    expect(report).toBe(
      "**What I was trying to do**\n\nSend tokens\n\n**What happened**\n\nThe page froze\n\n**What I expected**\n\nA confirmation",
    );
  });

  it("skips empty questions and trims answers", () => {
    expect(composeGuidedReport({ goal: "", actual: "  It froze  ", expected: "" })).toBe(
      "**What happened**\n\nIt froze",
    );
  });

  it("is empty when nothing was answered", () => {
    expect(composeGuidedReport(EMPTY_GUIDED_ANSWERS)).toBe("");
  });
});
