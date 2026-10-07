import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export type RoundStatus = NonNullable<
  NonNullable<Parameters<ApiClient["listRounds"]>[0]>["status"]
>;

export const roundKeys = {
  all: ["rounds"] as const,
  list: (status?: RoundStatus) => [...roundKeys.all, "list", status ?? "all"] as const,
  detail: (id: string) => [...roundKeys.all, "detail", id] as const,
  bySlug: (slug: string, number: number) => [...roundKeys.all, "slug", slug, number] as const,
  participants: (id: string) => [...roundKeys.detail(id), "participants"] as const,
  credits: (id: string) => [...roundKeys.detail(id), "credits"] as const,
  creditCandidates: (id: string) => [...roundKeys.detail(id), "credit-candidates"] as const,
  endorsements: (roundIds: string[]) => [...roundKeys.all, "endorsements", roundIds] as const,
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

export function roundBySlugQueryOptions(apiClient: ApiClient, slug: string, number: number) {
  return queryOptions({
    queryKey: roundKeys.bySlug(slug, number),
    queryFn: () => apiClient.getRoundBySlug({ slug, number }),
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

export function roundEndorsementsQueryOptions(apiClient: ApiClient, roundIds: string[]) {
  return queryOptions({
    queryKey: roundKeys.endorsements(roundIds),
    queryFn: () => apiClient.getRoundEndorsements({ roundIds }),
    enabled: roundIds.length > 0,
    staleTime: 60 * 1000,
  });
}

export function invalidateRoundQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: roundKeys.all });
}
