import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderKanban, LayoutDashboard, PlusCircle } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, EmptyState, Skeleton } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { pageHead } from "@/lib/page-title";
import { myProjectsQueryOptions } from "@/lib/queries/projects";
import { roundParams } from "@/lib/round-links";

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
                Request a round
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
          <ul className="space-y-4">
            {projects.map((project) => (
              <li key={project.id}>
                <Card className="p-5 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">{project.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{project.slug}</p>
                  </div>
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {project.rounds.map((round) => (
                      <li
                        key={round.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                      >
                        <Link
                          to="/manage/$slug/$n"
                          params={roundParams({ ...round, projectSlug: project.slug })}
                          className="text-sm font-medium text-foreground hover:underline"
                        >
                          #{round.projectRoundNumber} {round.title}
                        </Link>
                        <RoundStatusBadge status={round.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
