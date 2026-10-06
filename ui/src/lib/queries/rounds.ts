import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export type RoundStatus = NonNullable<Parameters<ApiClient["listRounds"]>[0]>["status"];

export const roundKeys = {
  all: ["rounds"] as const,
  list: (status?: RoundStatus) => [...roundKeys.all, "list", status ?? "all"] as const,
  detail: (id: string) => [...roundKeys.all, "detail", id] as const,
  participants: (id: string) => [...roundKeys.detail(id), "participants"] as const,
  credits: (id: string) => [...roundKeys.detail(id), "credits"] as const,
  creditCandidates: (id: string) => [...roundKeys.detail(id), "credit-candidates"] as const,
};

export function roundsQueryOptions(apiClient: ApiClient, status?: RoundStatus) {
  return queryOptions({
    queryKey: roundKeys.list(status),
    queryFn: () => apiClient.listRounds({ status }),
    staleTime: 30 * 1000,
  });
}

export function roundQueryOptions(apiClient: ApiClient, id: string) {
  return queryOptions({
    queryKey: roundKeys.detail(id),
    queryFn: () => apiClient.getRound({ id }),
    staleTime: 30 * 1000,
  });
}

export function roundParticipantsQueryOptions(apiClient: ApiClient, id: string) {
  return queryOptions({
    queryKey: roundKeys.participants(id),
    queryFn: () => apiClient.listParticipants({ id }),
  });
}

export function roundCreditsQueryOptions(apiClient: ApiClient, id: string) {
  return queryOptions({
    queryKey: roundKeys.credits(id),
    queryFn: () => apiClient.listRoundCredits({ id }),
  });
}

export function creditCandidatesQueryOptions(apiClient: ApiClient, id: string) {
  return queryOptions({
    queryKey: roundKeys.creditCandidates(id),
    queryFn: () => apiClient.getCreditCandidates({ id }),
  });
}

export function invalidateRoundQueries(queryClient: QueryClient, id?: string) {
  return queryClient.invalidateQueries({ queryKey: id ? roundKeys.detail(id) : roundKeys.all });
}
