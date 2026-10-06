import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export type ProjectStatus = NonNullable<Parameters<ApiClient["listProjects"]>[0]>["status"];

export const projectKeys = {
  all: ["projects"] as const,
  mine: () => [...projectKeys.all, "mine"] as const,
  list: (status?: ProjectStatus) => [...projectKeys.all, "list", status ?? "all"] as const,
};

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
