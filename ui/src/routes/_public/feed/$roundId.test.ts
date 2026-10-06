import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./$roundId");

const ROUND = { id: "r1", title: "Wallet onboarding", description: "Try the new flow" };

function loaderArgs(getRound: () => Promise<unknown>) {
  const apiClient = { getRound, listFeedback: vi.fn().mockResolvedValue([]) };
  return {
    context: { queryClient: new QueryClient(), apiClient },
    params: { roundId: "r1" },
  } as never;
}

describe("/feed/$roundId loader", () => {
  it("titles the page with the round, not its id", async () => {
    const loaderData = await Route.options.loader?.(loaderArgs(async () => ROUND));
    const head = await Route.options.head?.({ loaderData } as never);
    expect(head?.meta?.[0]).toEqual({ title: "Wallet onboarding | Feedback Rounds" });
  });

  it("renders not-found for a missing round", async () => {
    const error = await Promise.resolve(
      Route.options.loader?.(loaderArgs(() => Promise.reject(new ORPCError("NOT_FOUND")))),
    ).catch((e) => e);
    expect(isNotFound(error)).toBe(true);
  });
});
