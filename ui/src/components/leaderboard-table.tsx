import { Link } from "@tanstack/react-router";
import { createColumnHelper, flexRender, tableFeatures, useTable } from "@tanstack/react-table";
import { useMemo } from "react";
import type { ApiClient } from "@/app";
import { Badge } from "@/components";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contributionsLabel } from "@/lib/leaderboard";

type LeaderboardEntry = Awaited<ReturnType<ApiClient["getLeaderboard"]>>["data"][number];

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentAccountId?: string | null;
}

const features = tableFeatures({});

const columnHelper = createColumnHelper<typeof features, LeaderboardEntry>();

const COLUMN_CLASS: Record<string, string> = {
  rank: "w-16",
  contributions: "text-right",
  score: "text-right",
};

export function LeaderboardTable({ entries, currentAccountId }: LeaderboardTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("rank", {
          id: "rank",
          header: "Rank",
          cell: ({ row }) => (
            <Badge
              variant={row.original.rank <= 3 ? "secondary" : "outline"}
              className="text-[10px]"
            >
              #{row.original.rank}
            </Badge>
          ),
        }),
        columnHelper.accessor("actor", {
          id: "builder",
          header: "Builder",
          cell: ({ row }) => (
            <>
              <Link
                to="/$accountId"
                params={{ accountId: row.original.actor }}
                className="font-mono text-sm font-medium text-foreground hover:underline break-all"
              >
                {row.original.actor}
              </Link>
              {row.original.actor === currentAccountId && (
                <Badge className="ml-2 text-[10px]">you</Badge>
              )}
            </>
          ),
        }),
        columnHelper.accessor("eventCount", {
          id: "contributions",
          header: "Contributions",
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground tabular-nums">
              {contributionsLabel(row.original.eventCount)}
            </span>
          ),
        }),
        columnHelper.accessor("score", {
          id: "score",
          header: "Score",
          cell: ({ row }) => (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {row.original.score}
            </span>
          ),
        }),
      ]),
    [currentAccountId],
  );

  const table = useTable({
    features,
    columns,
    data: entries,
    getRowId: (entry) => entry.actor,
  });

  return (
    <Table data-testid="leaderboard-table">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={COLUMN_CLASS[header.column.id]}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cell.column.id === "builder" ? "min-w-0" : COLUMN_CLASS[cell.column.id]}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
