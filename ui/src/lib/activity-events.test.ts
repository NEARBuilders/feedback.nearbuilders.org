import { describe, expect, it } from "vitest";
import { endorsementLabel, roundActivityUrl, toActivityEventViews } from "./activity-events";

const base = {
  id: "e1",
  source: "feedback",
  sourceDisplayName: "Feedback",
  timestamp: "2026-04-03T10:00:00.000Z",
};

describe("toActivityEventViews", () => {
  it("labels known types and appends the round title", () => {
    const [view] = toActivityEventViews([
      { ...base, type: "round.opened", payload: { title: "Try onboarding" } },
    ]);
    expect(view).toEqual({
      id: "e1",
      sourceLabel: "Feedback",
      summary: "Opened round: Try onboarding",
      on: "Apr 3, 2026",
    });
  });

  it("falls back to the raw type for other apps' events and tolerates empty payloads", () => {
    const [view] = toActivityEventViews([
      { ...base, sourceDisplayName: "", source: "github", type: "github.pr.merged", payload: {} },
    ]);
    expect(view?.summary).toBe("github.pr.merged");
    expect(view?.sourceLabel).toBe("github");
  });

  it("returns an empty date for an unparseable timestamp", () => {
    const [view] = toActivityEventViews([
      { ...base, timestamp: "nope", type: "round.closed", payload: {} },
    ]);
    expect(view?.on).toBe("");
  });
});

describe("endorsementLabel", () => {
  it("pluralises", () => {
    expect(endorsementLabel(1)).toBe("1 endorsement");
    expect(endorsementLabel(0)).toBe("0 endorsements");
  });
});

describe("roundActivityUrl", () => {
  it("filters activity's feed to the owner's round.opened events", () => {
    expect(roundActivityUrl("owner.near")).toBe(
      "https://activity.nearbuilders.org/activity?actor=owner.near&type=round.opened",
    );
  });
});
