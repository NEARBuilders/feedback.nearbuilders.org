import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const failedActivityKeys = {
  all: ["admin", "failed-activity"] as const,
};

export function failedActivityQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: failedActivityKeys.all,
    queryFn: () => apiClient.listFailedActivityEvents(),
  });
}

export const roundFailedActivityKeys = {
  round: (roundId: string) => ["rounds", roundId, "failed-activity"] as const,
};

export function roundFailedActivityQueryOptions(apiClient: ApiClient, roundId: string) {
  return queryOptions({
    queryKey: roundFailedActivityKeys.round(roundId),
    queryFn: () => apiClient.listRoundFailedActivity({ id: roundId }),
  });
}
