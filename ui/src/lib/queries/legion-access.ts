import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const legionAccessQueryKeys = {
  all: ["legion-access"] as const,
};

export interface LegionAccessResult {
  hasAccess: boolean;
  linkedNearAccount: string | null;
  mintUrl: string;
}

export function legionAccessQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: legionAccessQueryKeys.all,
    queryFn: async (): Promise<LegionAccessResult> => await apiClient.getMyLegionAccess(),
    staleTime: 60 * 1000,
  });
}

export function invalidateLegionAccess(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: legionAccessQueryKeys.all });
}
