import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const feedbackKeys = {
  all: ["feedback"] as const,
  round: (roundId: string) => [...feedbackKeys.all, "round", roundId] as const,
};

export function roundFeedbackQueryOptions(apiClient: ApiClient, roundId: string) {
  return queryOptions({
    queryKey: feedbackKeys.round(roundId),
    queryFn: () => apiClient.listFeedback({ id: roundId }),
  });
}

export function invalidateFeedbackQueries(queryClient: QueryClient, roundId: string) {
  return queryClient.invalidateQueries({ queryKey: feedbackKeys.round(roundId) });
}
