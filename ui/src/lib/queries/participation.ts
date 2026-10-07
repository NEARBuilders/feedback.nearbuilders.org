import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const participationKeys = {
  all: ["participation"] as const,
  round: (roundId: string) => [...participationKeys.all, "round", roundId] as const,
  joined: () => [...participationKeys.all, "joined"] as const,
};

export function participationQueryOptions(apiClient: ApiClient, roundId: string) {
  return queryOptions({
    queryKey: participationKeys.round(roundId),
    queryFn: () => apiClient.getMyParticipation({ id: roundId }),
  });
}

export function joinedRoundsQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: participationKeys.joined(),
    queryFn: () => apiClient.listMyJoinedRounds(),
    staleTime: 30 * 1000,
  });
}

export function invalidateParticipationQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: participationKeys.all });
}
