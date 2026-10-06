import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./$n");

function beforeLoad(round: { canManage: boolean }, isAdmin = false) {
  const getRoundBySlug = vi.fn().mockResolvedValue({ id: "r1", title: "Round", ...round });
  return Promise.resolve(
    Route.options.beforeLoad?.({
      context: {
        queryClient: new QueryClient(),
        apiClient: { getRoundBySlug },
        auth: { isAdmin },
      },
      params: { slug: "near-wallet", n: "3" },
    } as never),
  ).catch((error) => error);
}

describe("/manage/$slug/$n guard", () => {
  it("sends non-managers to the public round page", async () => {
    await expect(beforeLoad({ canManage: false })).resolves.toMatchObject({
      options: { to: "/projects/$slug/$n", params: { slug: "near-wallet", n: "3" } },
    });
  });

  it("lets managers and site admins in", async () => {
    await expect(beforeLoad({ canManage: true })).resolves.toBeUndefined();
    await expect(beforeLoad({ canManage: false }, true)).resolves.toBeUndefined();
  });
});
