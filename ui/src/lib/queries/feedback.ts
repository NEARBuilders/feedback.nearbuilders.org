import { infiniteQueryOptions, type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

type FeedbackPage = Awaited<ReturnType<ApiClient["listFeedback"]>>;
export type FeedbackEntry = FeedbackPage["items"][number];
export type FeedbackStatus = FeedbackEntry["status"];

export interface FeedbackFilters {
  status?: FeedbackStatus;
  author?: string;
  /** Only submissions a round manager starred (#104). */
  starred?: boolean;
}

export const feedbackKeys = {
  all: ["feedback"] as const,
  round: (roundId: string) => [...feedbackKeys.all, "round", roundId] as const,
  list: (roundId: string, filters: FeedbackFilters) =>
    [...feedbackKeys.round(roundId), "list", filters] as const,
  item: (roundId: string, feedbackId: string) =>
    [...feedbackKeys.round(roundId), "item", feedbackId] as const,
  mine: (roundId: string) => [...feedbackKeys.round(roundId), "mine"] as const,
};

export function roundFeedbackQueryOptions(
  apiClient: ApiClient,
  roundId: string,
  filters: FeedbackFilters = {},
) {
  return infiniteQueryOptions({
    queryKey: feedbackKeys.list(roundId, filters),
    queryFn: ({ pageParam }) =>
      apiClient.listFeedback({ id: roundId, cursor: pageParam, ...filters }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function feedbackItemQueryOptions(
  apiClient: ApiClient,
  roundId: string,
  feedbackId: string,
) {
  return queryOptions({
    queryKey: feedbackKeys.item(roundId, feedbackId),
    queryFn: () => apiClient.getFeedback({ id: roundId, feedbackId }),
  });
}

export function myFeedbackQueryOptions(apiClient: ApiClient, roundId: string) {
  return queryOptions({
    queryKey: feedbackKeys.mine(roundId),
    queryFn: () => apiClient.listMyFeedback({ id: roundId }),
  });
}

export function invalidateFeedbackQueries(queryClient: QueryClient, roundId: string) {
  return queryClient.invalidateQueries({ queryKey: feedbackKeys.round(roundId) });
}
