import { useSuspenseQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { type ApiClient, useApiClient } from "@/app";
import { orNotFound } from "@/lib/queries/not-found";
import { managedProjectQueryOptions, projectQueryOptions } from "@/lib/queries/projects";
import type { LoaderContext } from "@/lib/round-route";

export type ProjectDetail = Awaited<ReturnType<ApiClient["getProjectBySlug"]>>;

export function loadProject({ queryClient, apiClient }: LoaderContext, slug: string) {
  return orNotFound(queryClient.ensureQueryData(projectQueryOptions(apiClient, slug)));
}

export function loadManagedProject({ queryClient, apiClient }: LoaderContext, slug: string) {
  return orNotFound(queryClient.ensureQueryData(managedProjectQueryOptions(apiClient, slug)));
}

export async function requireProjectManager(
  context: LoaderContext & { auth: { isAdmin: boolean } },
  slug: string,
) {
  const project = await loadManagedProject(context, slug);
  if (!project.canManage && !context.auth.isAdmin) {
    throw redirect({ to: "/projects/$slug", params: { slug } });
  }
  return project;
}

export function useProject(slug: string): ProjectDetail {
  const apiClient = useApiClient();
  return useSuspenseQuery(projectQueryOptions(apiClient, slug)).data;
}

export type ManagedProjectDetail = Awaited<ReturnType<ApiClient["getManagedProjectBySlug"]>>;

export function useManagedProject(slug: string): ManagedProjectDetail {
  const apiClient = useApiClient();
  return useSuspenseQuery(managedProjectQueryOptions(apiClient, slug)).data;
}
