import { describe, expect, it } from "vitest";
import { reportHints } from "./report-hints";

describe("reportHints (#300)", () => {
  it("says nothing before the tester starts writing", () => {
    expect(reportHints("")).toEqual([]);
    expect(reportHints("  \n ")).toEqual([]);
  });

  it("asks for more on a very short report", () => {
    expect(reportHints("Button broken").map((hint) => hint.id)).toEqual(["short"]);
  });

  it("asks what happened before and what was expected when both are missing", () => {
    const body = `The dashboard looks wrong and the numbers do not line up with anything I have seen elsewhere in the product so far.`;
    expect(reportHints(body).map((hint) => hint.id)).toEqual(["steps", "expected"]);
  });

  it("is satisfied by a report that has steps and an expectation", () => {
    const body = `I opened the settings page, then clicked save. I expected a confirmation toast but the page just froze for a few seconds.`;
    expect(reportHints(body)).toEqual([]);
  });

  it("does not count markdown syntax or images as writing", () => {
    expect(reportHints("![Screenshot](https://cdn.example/a.png)").map((hint) => hint.id)).toEqual(
      [],
    );
  });
});
