import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const tenantQueryKeys = {
  all: ["tenants"] as const,
  lists: () => [...tenantQueryKeys.all, "list"] as const,
  list: () => [...tenantQueryKeys.lists(), "all"] as const,
  organizationIds: (organizationIds: readonly string[]) =>
    [...tenantQueryKeys.lists(), "organizations", organizationIds] as const,
};

export function tenantsQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: tenantQueryKeys.list(),
    queryFn: () => apiClient.listTenants(),
    staleTime: 30 * 1000,
  });
}

export function tenantOrganizationIdsQueryOptions(
  apiClient: ApiClient,
  organizationIds: readonly string[],
) {
  return queryOptions({
    queryKey: tenantQueryKeys.organizationIds(organizationIds),
    queryFn: async () => {
      const results = await Promise.allSettled(
        organizationIds.map((orgId) => apiClient.resolveTenantByOrgId({ orgId })),
      );
      return new Set(organizationIds.filter((_, index) => results[index]?.status === "fulfilled"));
    },
    staleTime: 60 * 1000,
  });
}

export function invalidateTenantQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: tenantQueryKeys.all });
}
