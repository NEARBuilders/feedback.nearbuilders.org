import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { useApiClient } from "@/app";
import { EmptyState } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectDirectory } from "@/components/project-directory";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { publicProjectsQueryOptions } from "@/lib/queries/projects";

export const Route = createFileRoute("/_public/projects/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(publicProjectsQueryOptions(context.apiClient)),
  head: () => pageHead("Projects", "Products using feedback rounds to find testers."),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: ProjectsPage,
});

function ProjectsPage() {
  const apiClient = useApiClient();
  const { data: projects } = useSuspenseQuery(publicProjectsQueryOptions(apiClient));

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          label="Feedback Rounds"
          title="Projects"
          description="Products using feedback rounds to find testers."
        />
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet." className="min-h-[30vh]" />
        ) : (
          <ProjectDirectory projects={projects} />
        )}
      </div>
    </PageContainer>
  );
}
