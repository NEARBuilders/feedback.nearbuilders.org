import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, FolderKanban, PlusCircle, Users } from "lucide-react";
import { useApiClient } from "@/app";
import { Button, SectionHeader } from "@/components";
import { ActionCard } from "@/components/action-card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectRoundsTable } from "@/components/project-rounds-table";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { loadProject, requireProjectManager, useProject } from "@/lib/project-route";
import { orgTeamsQueryOptions } from "@/lib/queries/teams";
import { describeDelegation } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/")({
  beforeLoad: async ({ context, params }) => {
    await requireProjectManager(context, params.slug);
  },
  loader: async ({ context, params }) => {
    const project = await loadProject(context, params.slug);
    return { name: project.name };
  },
  head: ({ loaderData }) => pageHead(loaderData && `Console · ${loaderData.name}`),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Project not found." backTo="/manage" />,
  component: ProjectConsolePage,
});

function ProjectConsolePage() {
  const { slug } = Route.useParams();
  const project = useProject(slug);
  const apiClient = useApiClient();
  const teamsQuery = useQuery(orgTeamsQueryOptions(apiClient, project.ownerOrgId ?? ""));
  const latest = project.rounds.at(-1);

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          label="Project console"
          title={project.name}
          description="Start rounds and see who manages this project."
          actions={
            <>
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/$slug" params={{ slug }}>
                  <Eye className="h-3.5 w-3.5" />
                  public page
                </Link>
              </Button>
              {project.status === "approved" && (
                <Button asChild size="sm">
                  <Link
                    to="/manage/$slug/new"
                    params={{ slug }}
                    search={latest ? { from: latest.projectRoundNumber } : {}}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    start round
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {project.ownerOrgId && (
          <ActionCard>
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              Managed by: {describeDelegation(teamsQuery.data ?? [], project.managingTeamId)}
            </span>
            <Link to="/orgs" className="text-sm text-muted-foreground underline">
              Change in organizations
            </Link>
          </ActionCard>
        )}

        <section className="space-y-3">
          <SectionHeader title="Rounds" />
          <ProjectRoundsTable projects={[project]} console />
        </section>
      </div>
    </PageContainer>
  );
}
