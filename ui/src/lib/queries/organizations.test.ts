import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "@/lib/auth";
import { organizationsQueryOptions } from "./organizations";

type OrganizationListResult = Awaited<ReturnType<AuthClient["organization"]["list"]>>;

function authClient(
  implementation: () => Promise<{ data: unknown; error: { message: string } | null }>,
): AuthClient {
  return {
    organization: { list: vi.fn(implementation) },
  } as unknown as AuthClient;
}

async function observe(queryClient: QueryClient, auth: AuthClient) {
  const observer = new QueryObserver(queryClient, organizationsQueryOptions(auth));
  const unsubscribe = observer.subscribe(() => {});
  await vi.waitFor(() => expect(observer.getCurrentResult().isFetching).toBe(false));
  const result = observer.getCurrentResult();
  unsubscribe();
  return result;
}

describe("organizationsQueryOptions", () => {
  it("surfaces fetch failures instead of caching an empty list", async () => {
    const auth = authClient(() =>
      Promise.resolve({ data: undefined, error: { message: "Session expired" } }),
    );

    const result = await observe(new QueryClient(), auth);
    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
    expect((result.error as Error).message).toBe("Session expired");
  });

  it("returns the org list when the fetch succeeds", async () => {
    const orgs = [{ id: "org-1", name: "NearLegion", slug: "near-legion" }];
    const auth = authClient(
      () => Promise.resolve({ data: orgs, error: null }) as unknown as OrganizationListResult,
    );

    const result = await observe(new QueryClient(), auth);
    expect(result.isError).toBe(false);
    expect(result.data).toEqual(orgs);
  });
});
