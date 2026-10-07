import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, FolderKanban, LayoutDashboard, PlayCircle } from "lucide-react";
import { Button } from "@/components";
import { ActionCard } from "@/components/action-card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { ProjectRoundsTable } from "@/components/project-rounds-table";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { loadProject, useProject } from "@/lib/project-route";
import { roundParams } from "@/lib/round-links";

export const Route = createFileRoute("/_public/projects/$slug/")({
  loader: async ({ context, params }) => {
    const project = await loadProject(context, params.slug);
    return { name: project.name, description: project.nearbuilders?.description ?? undefined };
  },
  head: ({ loaderData }) => pageHead(loaderData?.name, loaderData?.description),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Project not found." backTo="/projects" />,
  component: ProjectPage,
});

function ProjectPage() {
  const { slug } = Route.useParams();
  const project = useProject(slug);
  const current = project.rounds.filter((round) => round.status === "open").at(-1);
  const nearbuilders = project.nearbuilders;

  return (
    <PageContainer>
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          label="Project"
          title={project.name}
          subtitle={project.slug}
          description={nearbuilders?.description ?? `Feedback rounds for ${project.name}.`}
          actions={
            <>
              {nearbuilders && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`https://nearbuilders.org/projects/${nearbuilders.kind}/${nearbuilders.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    nearbuilders.org
                  </a>
                </Button>
              )}
              {project.canManage && (
                <Button asChild size="sm">
                  <Link to="/manage/$slug" params={{ slug }}>
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    manage
                  </Link>
                </Button>
              )}
            </>
          }
        />

        {current && (
          <ActionCard className="p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current round
              </p>
              <p className="font-semibold text-foreground">{current.title}</p>
            </div>
            <Button asChild>
              <Link to="/projects/$slug/$n" params={roundParams({ ...current, projectSlug: slug })}>
                <PlayCircle className="h-4 w-4" />
                join round {current.projectRoundNumber}
              </Link>
            </Button>
          </ActionCard>
        )}

        <section className="space-y-3">
          <SectionHeader title="Rounds" />
          <ProjectRoundsTable projects={[project]} />
        </section>
      </div>
    </PageContainer>
  );
}
