import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "@/app";
import { type LegionAccessResult, legionAccessQueryOptions } from "./legion-access";

const holder: LegionAccessResult = {
  hasAccess: true,
  linkedNearAccount: "holder.near",
  mintUrl: "https://nearlegion.com/mint",
};

const nonHolder: LegionAccessResult = {
  hasAccess: false,
  linkedNearAccount: "visitor.near",
  mintUrl: "https://nearlegion.com/mint",
};

async function observe(
  queryClient: QueryClient,
  apiClient: ApiClient,
  userId: string | null,
  enabled: boolean,
) {
  const observer = new QueryObserver(
    queryClient,
    legionAccessQueryOptions(apiClient, userId, enabled),
  );
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));
  const data = observer.getCurrentResult().data;
  unsubscribe();
  return data;
}

describe("legionAccessQueryOptions", () => {
  it("never asks the API for a signed-out viewer", async () => {
    const getMyLegionAccess = vi.fn().mockResolvedValue(nonHolder);
    const apiClient = { getMyLegionAccess } as unknown as ApiClient;

    await expect(observe(new QueryClient(), apiClient, null, true)).resolves.toBeUndefined();
    expect(getMyLegionAccess).not.toHaveBeenCalled();
  });

  it("never asks the API while the viewer can't join a Legion round", async () => {
    const getMyLegionAccess = vi.fn().mockResolvedValue(holder);
    const apiClient = { getMyLegionAccess } as unknown as ApiClient;

    await expect(observe(new QueryClient(), apiClient, "user-1", false)).resolves.toBeUndefined();
    expect(getMyLegionAccess).not.toHaveBeenCalled();
  });

  it("checks each viewer separately instead of reusing another viewer's answer", async () => {
    const queryClient = new QueryClient();
    const getMyLegionAccess = vi.fn().mockResolvedValueOnce(nonHolder).mockResolvedValue(holder);
    const apiClient = { getMyLegionAccess } as unknown as ApiClient;

    await expect(observe(queryClient, apiClient, "visitor", true)).resolves.toEqual(nonHolder);
    await expect(observe(queryClient, apiClient, "holder", true)).resolves.toEqual(holder);
    expect(getMyLegionAccess).toHaveBeenCalledTimes(2);
  });
});
