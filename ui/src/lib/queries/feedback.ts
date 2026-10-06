import { infiniteQueryOptions, type QueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export type FeedbackPage = Awaited<ReturnType<ApiClient["listFeedback"]>>;
export type FeedbackEntry = FeedbackPage["items"][number];

export const feedbackKeys = {
  all: ["feedback"] as const,
  round: (roundId: string) => [...feedbackKeys.all, "round", roundId] as const,
};

export function roundFeedbackQueryOptions(apiClient: ApiClient, roundId: string) {
  return infiniteQueryOptions({
    queryKey: feedbackKeys.round(roundId),
    queryFn: ({ pageParam }) => apiClient.listFeedback({ id: roundId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function invalidateFeedbackQueries(queryClient: QueryClient, roundId: string) {
  return queryClient.invalidateQueries({ queryKey: feedbackKeys.round(roundId) });
}
