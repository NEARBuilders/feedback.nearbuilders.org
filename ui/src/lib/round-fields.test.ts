import { describe, expect, it } from "vitest";
import { EMPTY_ROUND_FIELDS, nextRoundFields, roundFieldsComplete } from "./round-fields";

const complete = {
  title: "Checkout",
  description: "Try paying",
  readme: "",
  formats: ["written" as const],
  repoUrl: "",
  isPrivate: false,
  legionOnly: false,
  contact: "",
};

describe("roundFieldsComplete", () => {
  it("needs a title, a description and a format", () => {
    expect(roundFieldsComplete(complete)).toBe(true);
    expect(roundFieldsComplete(EMPTY_ROUND_FIELDS)).toBe(false);
    expect(roundFieldsComplete({ ...complete, title: "  " })).toBe(false);
  });

  it("needs a repo for the issues format", () => {
    expect(roundFieldsComplete({ ...complete, formats: ["issues"] })).toBe(false);
    expect(
      roundFieldsComplete({ ...complete, formats: ["issues"], repoUrl: "https://github.com/a/b" }),
    ).toBe(true);
  });
});

describe("nextRoundFields", () => {
  it("carries the readme, formats and repo of a previous round into the next one", () => {
    expect(
      nextRoundFields({
        title: "Checkout",
        description: "Try paying",
        readme: "## Steps",
        formats: ["written", "issues"],
        repoUrl: "https://github.com/a/b",
        isPrivate: true,
        legionOnly: false,
      }),
    ).toEqual({
      title: "Checkout",
      description: "Try paying",
      readme: "## Steps",
      formats: ["written", "issues"],
      repoUrl: "https://github.com/a/b",
      isPrivate: true,
      legionOnly: false,
      contact: "",
    });
  });

  it("starts with written preselected without a previous round", () => {
    expect(nextRoundFields(null)).toEqual({
      ...EMPTY_ROUND_FIELDS,
      formats: ["written"],
    });
    expect(roundFieldsComplete(nextRoundFields(null))).toBe(false);
  });
});
