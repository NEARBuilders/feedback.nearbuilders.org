import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export function partnerSuggestionsQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: ["partners", "suggestions"] as const,
    queryFn: () => apiClient.listPartnerSuggestions(),
    staleTime: 60 * 1000,
  });
}
