import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";
import { useApiClient } from "@/app";
import { Card, EmptyState } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectRoundList } from "@/components/project-round-list";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { publicProjectsQueryOptions } from "@/lib/queries/projects";

export const Route = createFileRoute("/_public/projects/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(publicProjectsQueryOptions(context.apiClient)),
  head: () => pageHead("Projects", "Projects running feedback rounds, with their rounds."),
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
        <PageHeader icon={FolderKanban} label="Feedback Rounds" title="Projects" />
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet." className="min-h-[30vh]" />
        ) : (
          <ul className="space-y-4">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="p-5 space-y-3">
                  <Link
                    to="/projects/$slug"
                    params={{ slug: project.slug }}
                    className="block font-semibold text-foreground hover:underline"
                  >
                    {project.name}
                  </Link>
                  <ProjectRoundList project={project} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
