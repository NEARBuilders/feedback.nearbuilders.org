import { describe, expect, it } from "vitest";
import { endorsementLabel, roundActivityUrl } from "./activity-events";

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
