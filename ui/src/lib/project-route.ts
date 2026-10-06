import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { type ApiClient, useApiClient } from "@/app";
import { orNotFound } from "@/lib/queries/not-found";
import { projectQueryOptions } from "@/lib/queries/projects";

export type ProjectDetail = Awaited<ReturnType<ApiClient["getProjectBySlug"]>>;

interface LoaderContext {
  queryClient: QueryClient;
  apiClient: ApiClient;
}

export function loadProject({ queryClient, apiClient }: LoaderContext, slug: string) {
  return orNotFound(queryClient.ensureQueryData(projectQueryOptions(apiClient, slug)));
}

export async function requireProjectManager(
  context: LoaderContext & { auth: { isAdmin: boolean } },
  slug: string,
) {
  const project = await loadProject(context, slug);
  if (!project.canManage && !context.auth.isAdmin) {
    throw redirect({ to: "/projects/$slug", params: { slug } });
  }
  return project;
}

export function useProject(slug: string): ProjectDetail {
  const apiClient = useApiClient();
  return useSuspenseQuery(projectQueryOptions(apiClient, slug)).data;
}
