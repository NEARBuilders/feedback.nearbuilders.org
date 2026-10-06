import { describe, expect, it } from "vitest";
import {
  awaitingFeedback,
  feedbackPostedLabel,
  issuesUrl,
  nextAction,
  sortWorkspaceRounds,
  summarizeWorkspace,
  type WorkspaceRound,
} from "./tester-workspace";

function round(overrides: Partial<WorkspaceRound> = {}): WorkspaceRound {
  return {
    roundId: "r1",
    roundTitle: "Round",
    projectSlug: "project",
    projectRoundNumber: 1,
    status: "open",
    formats: ["written"],
    readme: "",
    repoUrl: null,
    participantCount: 1,
    myFeedbackCount: 0,
    joinedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("nextAction", () => {
  it("asks for feedback on an open round the tester has not posted in", () => {
    expect(nextAction(round())).toEqual({ kind: "give-feedback", label: "Give feedback" });
  });

  it("offers more feedback once the tester has posted", () => {
    expect(nextAction(round({ myFeedbackCount: 2 })).kind).toBe("add-feedback");
  });

  it("sends issues-only rounds to the repo's issues", () => {
    expect(nextAction(round({ formats: ["issues"], repoUrl: "https://github.com/a/b" })).kind).toBe(
      "file-issues",
    );
    expect(nextAction(round({ formats: ["issues"], repoUrl: null })).kind).toBe("view-round");
  });

  it("just links to the round once it is not open", () => {
    expect(nextAction(round({ status: "closed" })).kind).toBe("view-round");
    expect(nextAction(round({ status: "pending" })).kind).toBe("view-round");
  });
});

describe("awaitingFeedback", () => {
  it("is true only for open rounds that take posted feedback and have none from the tester", () => {
    expect(awaitingFeedback(round())).toBe(true);
    expect(awaitingFeedback(round({ formats: ["recorded"] }))).toBe(true);
    expect(awaitingFeedback(round({ myFeedbackCount: 1 }))).toBe(false);
    expect(awaitingFeedback(round({ status: "closed" }))).toBe(false);
    expect(awaitingFeedback(round({ formats: ["issues"] }))).toBe(false);
  });
});

describe("sortWorkspaceRounds", () => {
  it("puts rounds awaiting feedback first, then other open rounds, then the rest, newest first", () => {
    const sorted = sortWorkspaceRounds([
      round({ roundId: "closed-new", status: "closed", joinedAt: "2026-10-05T00:00:00.000Z" }),
      round({ roundId: "open-posted", myFeedbackCount: 1, joinedAt: "2026-10-02T00:00:00.000Z" }),
      round({ roundId: "await-old", joinedAt: "2026-09-01T00:00:00.000Z" }),
      round({ roundId: "await-new", joinedAt: "2026-10-03T00:00:00.000Z" }),
      round({ roundId: "closed-old", status: "closed", joinedAt: "2026-09-02T00:00:00.000Z" }),
    ]);
    expect(sorted.map((r) => r.roundId)).toEqual([
      "await-new",
      "await-old",
      "open-posted",
      "closed-new",
      "closed-old",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [round({ roundId: "a", status: "closed" }), round({ roundId: "b" })];
    sortWorkspaceRounds(input);
    expect(input.map((r) => r.roundId)).toEqual(["a", "b"]);
  });
});

describe("summarizeWorkspace", () => {
  it("counts total, open and awaiting-feedback rounds", () => {
    expect(
      summarizeWorkspace([
        round(),
        round({ myFeedbackCount: 1 }),
        round({ status: "closed" }),
        round({ formats: ["issues"] }),
      ]),
    ).toEqual({ total: 4, open: 3, awaitingFeedback: 1 });
    expect(summarizeWorkspace([])).toEqual({ total: 0, open: 0, awaitingFeedback: 0 });
  });
});

describe("helpers", () => {
  it("builds the issues url without a trailing slash", () => {
    expect(issuesUrl("https://github.com/a/b/")).toBe("https://github.com/a/b/issues");
    expect(issuesUrl(null)).toBeNull();
  });

  it("describes how much feedback was posted", () => {
    expect(feedbackPostedLabel(0)).toBe("No feedback posted yet");
    expect(feedbackPostedLabel(1)).toBe("1 feedback item posted");
    expect(feedbackPostedLabel(3)).toBe("3 feedback items posted");
  });
});
