import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";
import { feedbackKeys } from "@/lib/queries/feedback";

/**
 * Nested under the round's feedback key on purpose: resolving, dismissing or starring
 * invalidates `feedbackKeys.round`, which then refreshes the suggestions too.
 */
export const suggestionKeys = {
  round: (roundId: string) => [...feedbackKeys.round(roundId), "suggestions"] as const,
};

export function suggestionsQueryOptions(apiClient: ApiClient, roundId: string) {
  return queryOptions({
    queryKey: suggestionKeys.round(roundId),
    queryFn: () => apiClient.listFeedbackSuggestions({ id: roundId }),
  });
}

export type FeedbackSuggestion = Awaited<ReturnType<ApiClient["listFeedbackSuggestions"]>>[number];
