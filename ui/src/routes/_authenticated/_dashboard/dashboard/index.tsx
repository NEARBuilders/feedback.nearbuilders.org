import { createFileRoute, redirect } from "@tanstack/react-router";
import { myProjectsQueryOptions } from "@/lib/queries/projects";

/**
 * /dashboard had no content of its own: a worse copy of /testing's joined
 * rounds, a worse copy of /manage's project list, and a tenant card. It now
 * just routes people to whichever of the two they actually came for.
 */
export const Route = createFileRoute("/_authenticated/_dashboard/dashboard/")({
  beforeLoad: async ({ context }) => {
    const projects = await context.queryClient
      .ensureQueryData(myProjectsQueryOptions(context.apiClient))
      .catch(() => []);
    throw redirect({ to: projects.length > 0 ? "/manage" : "/testing" });
  },
});
