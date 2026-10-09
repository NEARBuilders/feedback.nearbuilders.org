import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const legionAccessQueryKeys = {
  all: ["legion-access"] as const,
  viewer: (userId: string | null) => [...legionAccessQueryKeys.all, userId] as const,
};

export interface LegionAccessResult {
  hasAccess: boolean;
  linkedNearAccount: string | null;
  mintUrl: string;
}

export function legionAccessQueryOptions(
  apiClient: ApiClient,
  userId: string | null,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: legionAccessQueryKeys.viewer(userId),
    queryFn: async (): Promise<LegionAccessResult> => await apiClient.getMyLegionAccess(),
    staleTime: 60 * 1000,
    enabled: enabled && userId !== null,
  });
}
