import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./$n");

const ROUND = { id: "r1", title: "Wallet onboarding", description: "Try the new flow" };

function loaderArgs(getRoundBySlug: () => Promise<unknown>, n = "3") {
  return {
    context: { queryClient: new QueryClient(), apiClient: { getRoundBySlug } },
    params: { slug: "near-wallet", n },
  } as never;
}

async function loaderError(args: never) {
  return Promise.resolve(Route.options.loader?.(args)).catch((error) => error);
}

describe("/projects/$slug/$n loader", () => {
  it("titles the page with the round, not its id", async () => {
    const loaderData = await Route.options.loader?.(loaderArgs(async () => ROUND));
    const head = await Route.options.head?.({ loaderData } as never);
    expect(head?.meta?.[0]).toEqual({ title: "Wallet onboarding | Feedback Rounds" });
  });

  it("resolves the round by slug and number", async () => {
    const getRoundBySlug = vi.fn().mockResolvedValue(ROUND);
    await Route.options.loader?.(loaderArgs(getRoundBySlug));
    expect(getRoundBySlug).toHaveBeenCalledWith({ slug: "near-wallet", number: 3 });
  });

  it("renders not-found for a missing round", async () => {
    const error = await loaderError(loaderArgs(() => Promise.reject(new ORPCError("NOT_FOUND"))));
    expect(isNotFound(error)).toBe(true);
  });

  it("renders not-found for a round number that isn't a number", async () => {
    const getRoundBySlug = vi.fn();
    expect(isNotFound(await loaderError(loaderArgs(getRoundBySlug, "latest")))).toBe(true);
    expect(getRoundBySlug).not.toHaveBeenCalled();
  });
});
