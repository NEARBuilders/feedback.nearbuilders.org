import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export type ProjectStatus = NonNullable<Parameters<ApiClient["listProjects"]>[0]>["status"];

export const projectKeys = {
  all: ["projects"] as const,
  mine: () => [...projectKeys.all, "mine"] as const,
  list: (status?: ProjectStatus) => [...projectKeys.all, "list", status ?? "all"] as const,
  public: () => [...projectKeys.all, "public"] as const,
  detail: (slug: string) => [...projectKeys.all, "slug", slug] as const,
};

export function publicProjectsQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: projectKeys.public(),
    queryFn: () => apiClient.listPublicProjects(),
    staleTime: 30 * 1000,
  });
}

export function projectQueryOptions(apiClient: ApiClient, slug: string) {
  return queryOptions({
    queryKey: projectKeys.detail(slug),
    queryFn: () => apiClient.getProjectBySlug({ slug }),
    staleTime: 30 * 1000,
  });
}

export function myProjectsQueryOptions(apiClient: ApiClient) {
  return queryOptions({
    queryKey: projectKeys.mine(),
    queryFn: () => apiClient.listMyProjects(),
    retry: false,
  });
}

export function projectsQueryOptions(apiClient: ApiClient, status?: ProjectStatus) {
  return queryOptions({
    queryKey: projectKeys.list(status),
    queryFn: () => apiClient.listProjects({ status }),
  });
}

export function invalidateProjectQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: projectKeys.all });
}
