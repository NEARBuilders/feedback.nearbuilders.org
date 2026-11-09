/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloseRoundPanel } from "./close-round-panel";

const getCreditCandidates = vi.fn();
const closeRound = vi.fn();

vi.mock("@/app", () => ({
  useApiClient: () => ({ getCreditCandidates, closeRound }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CloseRoundPanel roundId="round-1" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close round" }));
}

describe("CloseRoundPanel", () => {
  beforeEach(() => {
    getCreditCandidates.mockReset();
    closeRound.mockReset();
  });

  afterEach(cleanup);

  it("shows an error and blocks closing when candidates fail to load", async () => {
    getCreditCandidates.mockRejectedValue(new Error("boom"));
    renderPanel();

    await screen.findByRole("alert");
    expect(screen.queryByText("No feedback was posted.")).toBeNull();
    const confirm = screen.getByRole("button", { name: "Confirm close" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(closeRound).not.toHaveBeenCalled();
  });

  it("loads candidates and enables closing after a retry succeeds", async () => {
    getCreditCandidates.mockRejectedValueOnce(new Error("boom"));
    getCreditCandidates.mockResolvedValueOnce([
      { accountId: "alice.near", writtenCount: 2, recordedCount: 0 },
    ]);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await screen.findByText("alice.near");
    expect(screen.queryByRole("alert")).toBeNull();
    const confirm = screen.getByRole("button", { name: "Confirm close" });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("still allows closing when the load succeeds and nobody posted feedback", async () => {
    getCreditCandidates.mockResolvedValue([]);
    renderPanel();

    await screen.findByText("No feedback was posted.");
    const confirm = screen.getByRole("button", { name: "Confirm close" });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  });
});
