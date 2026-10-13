import type { ApiClient } from "@/app";

export type FeedbackTester = Awaited<ReturnType<ApiClient["listFeedbackAuthors"]>>[number];

export const TESTER_FILTERS = ["unresolved", "done", "all"] as const;

export type TesterFilter = (typeof TESTER_FILTERS)[number];

export type TesterState = "unresolved" | "done";

/** A tester is done once none of their submissions is waiting for a decision. */
export function testerState(tester: Pick<FeedbackTester, "unresolvedCount">): TesterState {
  return tester.unresolvedCount > 0 ? "unresolved" : "done";
}

/** Testers matching the status filter and a wallet or Telegram search, in the given order. */
export function filterTesters(
  testers: FeedbackTester[],
  filter: TesterFilter,
  query = "",
): FeedbackTester[] {
  const needle = query.trim().replace(/^@/, "").toLowerCase();
  return testers.filter((tester) => {
    if (filter !== "all" && testerState(tester) !== filter) return false;
    if (!needle) return true;
    return (
      tester.accountId.toLowerCase().includes(needle) ||
      (tester.telegramHandle?.toLowerCase().includes(needle) ?? false)
    );
  });
}
