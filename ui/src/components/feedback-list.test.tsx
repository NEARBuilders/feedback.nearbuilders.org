/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedbackEntry } from "@/lib/queries/feedback";
import { FeedbackList } from "./feedback-list";

vi.mock("@/app", () => ({ useApiClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function entry(id: string, overrides: Partial<FeedbackEntry>): FeedbackEntry {
  return {
    id,
    roundId: "round-1",
    authorAccountId: "alice.near",
    format: "written",
    body: `feedback ${id}`,
    url: null,
    status: "unresolved",
    statusChangedAt: null,
    starredAt: null,
    starredByAccountId: null,
    createdAt: "2026-11-10T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  } as FeedbackEntry;
}

function renderList(entries: FeedbackEntry[]) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <FeedbackList
        roundId="round-1"
        entries={entries}
        currentAccountIds={["alice.near"]}
        canEdit
        canDelete
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("FeedbackList edit button", () => {
  it("shows Edit on unresolved, unstarred feedback", () => {
    renderList([entry("a", {})]);

    expect(screen.getAllByRole("button", { name: "Edit feedback" })).toHaveLength(1);
  });

  it("hides Edit once the owner resolved, dismissed or starred the feedback", () => {
    renderList([
      entry("a", { status: "resolved" }),
      entry("b", { status: "dismissed" }),
      entry("c", { starredAt: "2026-11-10T01:00:00.000Z" }),
    ]);

    expect(screen.queryByRole("button", { name: "Edit feedback" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Delete feedback" })).toHaveLength(3);
  });
});
