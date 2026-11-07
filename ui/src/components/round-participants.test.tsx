/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoundParticipants } from "./round-participants";

const api = vi.hoisted(() => ({
  listParticipants: vi.fn(),
  updateRoundSettings: vi.fn(),
}));

vi.mock("@/app", () => ({ useApiClient: () => api }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

const participants = ["alice.near", "bob.near", "carol.near"].map((accountId) => ({
  accountId,
  joinedAt: "2026-11-01T00:00:00.000Z",
  feedbackCount: 0,
}));

function renderParticipants(props: { winners?: string[]; canMarkWinners?: boolean }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RoundParticipants roundId="round-1" {...props} />
    </QueryClientProvider>,
  );
}

describe("RoundParticipants winners", () => {
  beforeEach(() => {
    api.listParticipants.mockReset().mockResolvedValue(participants);
    api.updateRoundSettings.mockReset().mockResolvedValue({});
  });
  afterEach(cleanup);

  it("shows no winner controls unless the viewer can mark winners", async () => {
    renderParticipants({ winners: ["alice.near"] });
    await screen.findByText("alice.near");
    expect(screen.queryByTestId("participant-winner-toggle")).toBeNull();
    expect(screen.getAllByLabelText("Winner")).toHaveLength(1);
  });

  it("appends a participant to the winners when marked", async () => {
    renderParticipants({ winners: ["alice.near"], canMarkWinners: true });
    await screen.findByText("bob.near");
    const toggles = screen.getAllByTestId("participant-winner-toggle");
    fireEvent.click(toggles[1]);
    await waitFor(() =>
      expect(api.updateRoundSettings).toHaveBeenCalledWith({
        id: "round-1",
        winners: ["alice.near", "bob.near"],
      }),
    );
  });

  it("removes a winner when unmarked", async () => {
    renderParticipants({ winners: ["alice.near", "bob.near"], canMarkWinners: true });
    await screen.findByText("alice.near");
    fireEvent.click(screen.getAllByTestId("participant-winner-toggle")[0]);
    await waitFor(() =>
      expect(api.updateRoundSettings).toHaveBeenCalledWith({
        id: "round-1",
        winners: ["bob.near"],
      }),
    );
  });

  it("moves a winner down and disables the ends", async () => {
    renderParticipants({ winners: ["alice.near", "bob.near"], canMarkWinners: true });
    await screen.findByText("alice.near");
    const up = screen.getAllByLabelText("Move winner up");
    const down = screen.getAllByLabelText("Move winner down");
    expect((up[0] as HTMLButtonElement).disabled).toBe(true);
    expect((down[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(down[0]);
    await waitFor(() =>
      expect(api.updateRoundSettings).toHaveBeenCalledWith({
        id: "round-1",
        winners: ["bob.near", "alice.near"],
      }),
    );
  });
});
