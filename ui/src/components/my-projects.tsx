import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useApiClient } from "@/app";
import { Badge, Card, SectionHeader } from "@/components";
import { myProjectsQueryOptions } from "@/lib/queries/projects";
import { roundParams } from "@/lib/round-links";

const PROJECT_STATUS_LABEL = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
} as const;

export function MyProjects() {
  const apiClient = useApiClient();
  const projectsQuery = useQuery(myProjectsQueryOptions(apiClient));
  const projects = projectsQuery.data ?? [];
  if (projects.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader title="Your projects" />
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id}>
            <Card className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{project.slug}</p>
                </div>
                <Badge variant={project.status === "rejected" ? "destructive" : "outline"}>
                  {PROJECT_STATUS_LABEL[project.status]}
                </Badge>
              </div>
              {project.status === "rejected" && project.rejectionReason && (
                <p className="text-sm text-foreground">{project.rejectionReason}</p>
              )}
              {project.rounds.length > 0 && (
                <ul className="space-y-1">
                  {project.rounds.map((round) => (
                    <li key={round.id} className="text-sm">
                      <Link
                        to="/projects/$slug/$n"
                        params={roundParams({ ...round, projectSlug: project.slug })}
                        className="text-foreground underline"
                      >
                        #{round.projectRoundNumber} {round.title}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">({round.status})</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
