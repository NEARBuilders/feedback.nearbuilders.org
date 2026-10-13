import { describe, expect, it } from "vitest";
import { type FeedbackTester, filterTesters, testerState } from "./feedback-testers";

function tester(accountId: string, overrides: Partial<FeedbackTester> = {}): FeedbackTester {
  return {
    accountId,
    telegramHandle: null,
    feedbackCount: 1,
    unresolvedCount: 1,
    resolvedCount: 0,
    dismissedCount: 0,
    starredCount: 0,
    firstPostedAt: "2026-10-01T00:00:00.000Z",
    lastPostedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const alice = tester("alice.near", { telegramHandle: "alice_tg" });
const bob = tester("bob.tg", { unresolvedCount: 0, resolvedCount: 1 });

describe("testerState", () => {
  it("is unresolved while any submission is unresolved", () => {
    expect(testerState(alice)).toBe("unresolved");
    expect(testerState(bob)).toBe("done");
  });
});

describe("filterTesters", () => {
  it("filters by state", () => {
    expect(filterTesters([alice, bob], "unresolved")).toEqual([alice]);
    expect(filterTesters([alice, bob], "done")).toEqual([bob]);
    expect(filterTesters([alice, bob], "all")).toEqual([alice, bob]);
  });

  it("searches wallets and Telegram handles, with or without @", () => {
    expect(filterTesters([alice, bob], "all", "BOB")).toEqual([bob]);
    expect(filterTesters([alice, bob], "all", "@alice_t")).toEqual([alice]);
    expect(filterTesters([alice, bob], "all", "nobody")).toEqual([]);
  });
});
