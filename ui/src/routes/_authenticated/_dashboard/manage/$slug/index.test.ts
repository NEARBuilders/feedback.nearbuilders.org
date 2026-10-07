import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./index");

function beforeLoad(canManage: boolean, isAdmin = false) {
  const getProjectBySlug = vi.fn().mockResolvedValue({ id: "p1", name: "Wallet", canManage });
  return Promise.resolve(
    Route.options.beforeLoad?.({
      context: {
        queryClient: new QueryClient(),
        apiClient: { getProjectBySlug },
        auth: { isAdmin },
      },
      params: { slug: "near-wallet" },
    } as never),
  ).catch((error) => error);
}

describe("/manage/$slug guard", () => {
  it("sends non-managers to the public project page", async () => {
    await expect(beforeLoad(false)).resolves.toMatchObject({
      options: { to: "/projects/$slug", params: { slug: "near-wallet" } },
    });
  });

  it("lets managers and site admins in", async () => {
    await expect(beforeLoad(true)).resolves.toBeUndefined();
    await expect(beforeLoad(false, true)).resolves.toBeUndefined();
  });
});
