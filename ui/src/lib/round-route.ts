import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { type ApiClient, useApiClient } from "@/app";
import { orNotFound } from "@/lib/queries/not-found";
import { roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { parseRoundNumber, type RoundParams } from "@/lib/round-links";

export type RoundDetail = Awaited<ReturnType<ApiClient["getRoundBySlug"]>>;

interface LoaderContext {
  queryClient: QueryClient;
  apiClient: ApiClient;
}

export function loadRound({ queryClient, apiClient }: LoaderContext, params: RoundParams) {
  const number = parseRoundNumber(params.n);
  if (number === null) throw notFound();
  return orNotFound(
    queryClient.ensureQueryData(roundBySlugQueryOptions(apiClient, params.slug, number)),
  );
}

export function useRound(params: RoundParams): RoundDetail {
  const apiClient = useApiClient();
  return useSuspenseQuery(roundBySlugQueryOptions(apiClient, params.slug, Number(params.n))).data;
}
