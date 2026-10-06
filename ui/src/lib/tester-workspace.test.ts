import { describe, expect, it } from "vitest";
import {
  awaitingFeedback,
  feedbackPostedLabel,
  groupWorkspaceRounds,
  issuesUrl,
  nextAction,
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

describe("groupWorkspaceRounds", () => {
  it("splits rounds into needs feedback, submitted and closed, newest joined first", () => {
    const groups = groupWorkspaceRounds([
      round({ roundId: "old-todo", joinedAt: "2026-01-01T00:00:00Z" }),
      round({ roundId: "done", myFeedbackCount: 2 }),
      round({ roundId: "new-todo", joinedAt: "2026-03-01T00:00:00Z" }),
      round({ roundId: "issues-only", formats: ["issues"] }),
      round({ roundId: "closed", status: "closed" }),
    ]);

    expect(groups.needsFeedback.map((r) => r.roundId)).toEqual(["new-todo", "old-todo"]);
    expect(groups.submitted.map((r) => r.roundId)).toEqual(["done", "issues-only"]);
    expect(groups.closed.map((r) => r.roundId)).toEqual(["closed"]);
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
