import { describe, expect, it } from "vitest";
import { acceptanceRate, acceptedLabel, pointsLabel } from "./points";

describe("pointsLabel", () => {
  it("pluralises points", () => {
    expect(pointsLabel(0)).toBe("0 points");
    expect(pointsLabel(1)).toBe("1 point");
    expect(pointsLabel(30)).toBe("30 points");
  });
});

describe("acceptedLabel", () => {
  it("states how many items were accepted", () => {
    expect(acceptedLabel(0)).toBe("0 accepted");
    expect(acceptedLabel(4)).toBe("4 accepted");
  });
});

describe("acceptanceRate", () => {
  it("rounds to a whole percent and shows a dash when nothing was submitted", () => {
    expect(acceptanceRate(1, 3)).toBe("33%");
    expect(acceptanceRate(2, 3)).toBe("67%");
    expect(acceptanceRate(4, 4)).toBe("100%");
    expect(acceptanceRate(0, 5)).toBe("0%");
    expect(acceptanceRate(0, 0)).toBe("—");
  });
});
