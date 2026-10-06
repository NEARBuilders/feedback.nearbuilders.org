import { Link } from "@tanstack/react-router";
import { RoundStatusBadge } from "@/components/round-status-badge";
import type { ProjectDetail } from "@/lib/project-route";
import { roundParams } from "@/lib/round-links";

type Project = Pick<ProjectDetail, "slug" | "rounds">;

export function ProjectRoundList({ project, console }: { project: Project; console?: boolean }) {
  if (project.rounds.length === 0) {
    return <p className="text-sm text-muted-foreground">No rounds yet.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {[...project.rounds].reverse().map((round) => (
        <li key={round.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
          <Link
            to={console ? "/manage/$slug/$n" : "/projects/$slug/$n"}
            params={roundParams({ ...round, projectSlug: project.slug })}
            className="min-w-0 truncate text-sm font-medium text-foreground hover:underline"
          >
            <span className="text-muted-foreground">#{round.projectRoundNumber}</span> {round.title}
          </Link>
          <RoundStatusBadge status={round.status} />
        </li>
      ))}
    </ul>
  );
}
