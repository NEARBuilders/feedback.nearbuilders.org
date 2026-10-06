import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./$roundId");

describe("/feed/$roundId", () => {
  it("redirects old uuid links to the canonical round URL", async () => {
    const getRound = vi
      .fn()
      .mockResolvedValue({ projectSlug: "near-wallet", projectRoundNumber: 3 });
    const result = await Promise.resolve(
      Route.options.beforeLoad?.({
        context: { queryClient: new QueryClient(), apiClient: { getRound } },
        params: { roundId: "0b5c" },
      } as never),
    ).catch((e) => e);
    expect(result).toMatchObject({
      options: { to: "/projects/$slug/$n", params: { slug: "near-wallet", n: "3" } },
    });
  });
});
