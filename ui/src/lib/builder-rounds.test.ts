import { describe, expect, it } from "vitest";
import {
  type BuilderRoundInput,
  formatRoundDate,
  submissionsLabel,
  toBuilderRoundViews,
} from "./builder-rounds";

const base: BuilderRoundInput = {
  roundId: "r1",
  roundTitle: "Try the onboarding flow",
  projectSlug: "my-project",
  contributedMeaningfully: true,
  summary: "Sharp bug reports",
  writtenCount: 2,
  recordedCount: 1,
  issuesUrl: "https://github.com/near/feedback/issues",
  closedAt: "2026-04-03T12:00:00.000Z",
};

describe("submissionsLabel", () => {
  it("joins the non-zero counts", () => {
    expect(submissionsLabel(2, 1)).toBe("2 written · 1 recorded");
    expect(submissionsLabel(0, 3)).toBe("3 recorded");
    expect(submissionsLabel(1, 0)).toBe("1 written");
  });

  it("is null when nothing was submitted in-app", () => {
    expect(submissionsLabel(0, 0)).toBeNull();
  });
});

describe("formatRoundDate", () => {
  it("formats an ISO timestamp in UTC", () => {
    expect(formatRoundDate("2026-04-03T12:00:00.000Z")).toBe("Apr 3, 2026");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(formatRoundDate("not-a-date")).toBe("");
  });
});

describe("toBuilderRoundViews", () => {
  it("is empty-safe for a builder with no credited rounds", () => {
    expect(toBuilderRoundViews([])).toEqual([]);
  });

  it("maps a credited round to its view model", () => {
    expect(toBuilderRoundViews([base])).toEqual([
      {
        roundId: "r1",
        roundTitle: "Try the onboarding flow",
        projectSlug: "my-project",
        contributedMeaningfully: true,
        summary: "Sharp bug reports",
        submissionsLabel: "2 written · 1 recorded",
        issuesUrl: "https://github.com/near/feedback/issues",
        closedOn: "Apr 3, 2026",
      },
    ]);
  });

  it("keeps a round with no in-app submissions and no issues link", () => {
    const [view] = toBuilderRoundViews([
      { ...base, writtenCount: 0, recordedCount: 0, issuesUrl: null, summary: null },
    ]);
    expect(view.submissionsLabel).toBeNull();
    expect(view.issuesUrl).toBeNull();
    expect(view.summary).toBeNull();
  });
});
