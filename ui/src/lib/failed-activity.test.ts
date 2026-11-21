import { describe, expect, it } from "vitest";
import { describeFailure, describeOutboxEvent, summariseFailed } from "./failed-activity";

const base = {
  operation: "emit" as const,
  eventType: null,
  actor: null,
  attempts: 1,
  lastError: null,
};

describe("describeOutboxEvent", () => {
  it("names known events", () => {
    expect(describeOutboxEvent({ ...base, eventType: "credit.awarded" })).toBe("Credit awarded");
    expect(describeOutboxEvent({ ...base, eventType: "round.closed" })).toBe("Round closed");
  });

  it("falls back to the raw type, then a generic label", () => {
    expect(describeOutboxEvent({ ...base, eventType: "custom.thing" })).toBe("custom.thing");
    expect(describeOutboxEvent(base)).toBe("Activity event");
  });

  it("labels retractions", () => {
    expect(describeOutboxEvent({ ...base, operation: "retract" })).toBe("Retract an earlier event");
  });
});

describe("describeFailure", () => {
  it("shows tries and the last error", () => {
    expect(describeFailure({ ...base, attempts: 5, lastError: " gateway down " })).toBe(
      "5 tries. gateway down",
    );
  });

  it("handles one try and no error", () => {
    expect(describeFailure(base)).toBe("1 try");
  });
});

describe("summariseFailed", () => {
  it("counts by event type, most common first", () => {
    const rows = [
      { operation: "emit", eventType: "credit.awarded" },
      { operation: "emit", eventType: "credit.awarded" },
      { operation: "emit", eventType: "round.closed" },
      { operation: "retract", eventType: null },
    ];
    expect(summariseFailed(rows)).toEqual([
      { kind: "credit.awarded", count: 2 },
      { kind: "round.closed", count: 1 },
      { kind: "retract", count: 1 },
    ]);
  });
});
