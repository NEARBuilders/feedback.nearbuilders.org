import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { type ApiClient, useApiClient } from "@/app";
import { orNotFound } from "@/lib/queries/not-found";
import { roundBySlugQueryOptions } from "@/lib/queries/rounds";
import type { RoundParams } from "@/lib/round-links";
import { positiveInt } from "@/lib/search";

export type RoundDetail = Awaited<ReturnType<ApiClient["getRoundBySlug"]>>;

export interface LoaderContext {
  queryClient: QueryClient;
  apiClient: ApiClient;
}

export function loadRound({ queryClient, apiClient }: LoaderContext, params: RoundParams) {
  const number = positiveInt(params.n);
  if (number === null) throw notFound();
  return orNotFound(
    queryClient.ensureQueryData(roundBySlugQueryOptions(apiClient, params.slug, number)),
  );
}

export async function requireRoundManager(
  context: LoaderContext & { auth: { isAdmin: boolean } },
  params: RoundParams,
) {
  const round = await loadRound(context, params);
  if (!round.canManage && !context.auth.isAdmin) {
    throw redirect({ to: "/projects/$slug/$n", params });
  }
}

export function useRound(params: RoundParams): RoundDetail {
  const apiClient = useApiClient();
  return useSuspenseQuery(roundBySlugQueryOptions(apiClient, params.slug, Number(params.n))).data;
}
