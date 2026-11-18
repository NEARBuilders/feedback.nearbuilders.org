import { Link } from "@tanstack/react-router";
import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import { RoundListTitle } from "@/components/round-list-title";
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
type ProjectRound = Project["rounds"][number];

type TableRowData =
  | { key: string; kind: "group"; project: Project }
  | { key: string; kind: "empty"; project: Project }
  | { key: string; kind: "round"; project: Project; round: ProjectRound };

interface ProjectRoundsTableProps {
  projects: Project[];
  console?: boolean;
  grouped?: boolean;
}

const features = tableFeatures({});

const columnHelper = createColumnHelper<typeof features, TableRowData>();

function buildRows(projects: Project[], grouped?: boolean): TableRowData[] {
  return projects.flatMap((project): TableRowData[] => {
    const header: TableRowData[] = grouped
      ? [{ key: `group:${project.id}`, kind: "group", project }]
      : [];
    if (project.rounds.length === 0) {
      return [...header, { key: `empty:${project.id}`, kind: "empty", project }];
    }
    const rounds = [...project.rounds].reverse().map(
      (round): TableRowData => ({
        key: `round:${round.id}`,
        kind: "round",
        project,
        round,
      }),
    );
    return [...header, ...rounds];
  });
}

export function ProjectRoundsTable({ projects, console, grouped }: ProjectRoundsTableProps) {
  const data = useMemo(() => buildRows(projects, grouped), [projects, grouped]);

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "round",
          header: "Round",
          cell: ({ row }) => {
            const entry = row.original;
            if (entry.kind !== "round") return null;
            return (
              <Link
                to={console ? "/manage/$slug/$n" : "/projects/$slug/$n"}
                params={roundParams({ ...entry.round, projectSlug: entry.project.slug })}
                className="font-medium text-foreground hover:underline"
              >
                <RoundListTitle
                  title={entry.round.title}
                  projectRoundNumber={entry.round.projectRoundNumber}
                />
              </Link>
            );
          },
        }),
        columnHelper.display({
          id: "status",
          header: "Status",
          cell: ({ row }) => {
            const entry = row.original;
            if (entry.kind !== "round") return null;
            return <RoundStatusBadge status={entry.round.status} endsAt={entry.round.endsAt} />;
          },
        }),
      ]),
    [console],
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (entry) => entry.key,
  });

  return (
    <Table data-testid="project-rounds">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.id === "status" ? "w-28 text-right" : undefined}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const entry = row.original;
          if (entry.kind === "group") {
            return (
              <TableRow key={row.id} className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={2}>
                  <Link
                    to={console ? "/manage/$slug" : "/projects/$slug"}
                    params={{ slug: entry.project.slug }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {entry.project.name}
                  </Link>
                </TableCell>
              </TableRow>
            );
          }
          if (entry.kind === "empty") {
            return (
              <TableRow key={row.id}>
                <TableCell colSpan={2} className="text-muted-foreground">
                  No rounds yet.
                </TableCell>
              </TableRow>
            );
          }
          return (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.id === "status" ? "text-right" : undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
