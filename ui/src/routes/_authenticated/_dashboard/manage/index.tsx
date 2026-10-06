import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, LayoutDashboard, PlusCircle } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, EmptyState, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectRoundsTable } from "@/components/project-rounds-table";
import { pageHead } from "@/lib/page-title";
import { myProjectsQueryOptions } from "@/lib/queries/projects";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/")({
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(myProjectsQueryOptions(context.apiClient)),
  head: () => pageHead("Manage", "The projects and rounds you manage."),
  component: ManagePage,
});

function ManagePage() {
  const apiClient = useApiClient();
  const projectsQuery = useQuery(myProjectsQueryOptions(apiClient));
  const projects = projectsQuery.data ?? [];

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={LayoutDashboard}
          label="Owner console"
          title="Manage"
          description="Review feedback and run the rounds your organization owns."
          actions={
            <Button asChild variant="outline">
              <Link to="/feed/request">
                <PlusCircle className="h-4 w-4" />
                request a round
              </Link>
            </Button>
          }
        />

        {projectsQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="You don't manage any rounds yet."
            description="Switch to the organization that owns a project, or request a round."
            className="min-h-[30vh]"
          />
        ) : (
          <ProjectRoundsTable projects={projects} console grouped />
        )}
      </div>
    </PageContainer>
  );
}
