import { Link } from "@tanstack/react-router";
import { ArrowRight, Globe } from "lucide-react";
import type { ApiClient } from "@/app";
import { Badge, Card } from "@/components";
import { ProjectAvatar, projectDomainLabel, projectDomainUrl } from "@/components/project-identity";
import { roundParams } from "@/lib/round-links";

type PublicProject = Awaited<ReturnType<ApiClient["listPublicProjects"]>>[number];

/**
 * The project directory answers "what products are here, and which want
 * testers" — as opposed to /rounds, which answers "what can I test right now".
 * Cards carry identity (logo, name, domain, description) because a bare slug
 * tells a visitor nothing about what the thing is.
 */
export function ProjectDirectory({ projects }: { projects: PublicProject[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="project-directory">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: PublicProject }) {
  const name = project.identity?.title ?? project.name;
  const domain = projectDomainLabel(project.identity);
  const domainUrl = projectDomainUrl(project.identity);
  const openRounds = project.rounds.filter((round) => round.status === "open");
  const latest = openRounds.at(-1) ?? project.rounds.at(-1);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <ProjectAvatar identity={project.identity} name={name} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <Link
            to="/projects/$slug"
            params={{ slug: project.slug }}
            className="block truncate font-semibold text-foreground hover:underline"
          >
            {name}
          </Link>
          {domainUrl ? (
            <a
              href={domainUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-3 w-3" />
              {domain}
            </a>
          ) : (
            <span className="font-mono text-xs text-muted-foreground">{project.slug}</span>
          )}
        </div>
        {openRounds.length > 0 && <Badge>{openRounds.length} open</Badge>}
      </div>

      {project.identity?.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{project.identity.description}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {project.rounds.length} {project.rounds.length === 1 ? "round" : "rounds"}
        </span>
        {latest && (
          <Link
            to="/projects/$slug/$n"
            params={roundParams({ ...latest, projectSlug: project.slug })}
            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
          >
            {latest.status === "open" ? "join round" : "latest round"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Card>
  );
}
