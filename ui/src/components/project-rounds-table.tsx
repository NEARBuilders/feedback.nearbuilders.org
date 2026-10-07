import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import { RoundStatusBadge } from "@/components/round-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectDetail } from "@/lib/project-route";
import { roundParams } from "@/lib/round-links";

type Project = Pick<ProjectDetail, "id" | "name" | "slug" | "rounds">;

interface ProjectRoundsTableProps {
  projects: Project[];
  console?: boolean;
  grouped?: boolean;
}

export function ProjectRoundsTable({ projects, console, grouped }: ProjectRoundsTableProps) {
  return (
    <Table data-testid="project-rounds">
      <TableHeader>
        <TableRow>
          <TableHead>Round</TableHead>
          <TableHead className="w-28 text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <Fragment key={project.id}>
            {grouped && (
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={2}>
                  <Link
                    to={console ? "/manage/$slug" : "/projects/$slug"}
                    params={{ slug: project.slug }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {project.name}
                  </Link>
                </TableCell>
              </TableRow>
            )}
            {project.rounds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No rounds yet.
                </TableCell>
              </TableRow>
            ) : (
              [...project.rounds].reverse().map((round) => (
                <TableRow key={round.id}>
                  <TableCell>
                    <Link
                      to={console ? "/manage/$slug/$n" : "/projects/$slug/$n"}
                      params={roundParams({ ...round, projectSlug: project.slug })}
                      className="font-medium text-foreground hover:underline"
                    >
                      <span className="text-muted-foreground">#{round.projectRoundNumber}</span>{" "}
                      {round.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <RoundStatusBadge status={round.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
