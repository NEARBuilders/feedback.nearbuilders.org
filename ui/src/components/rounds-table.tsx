import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { type ApiClient, sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge, Button, LegionMark } from "@/components";
import { EndorsementCount } from "@/components/endorsement-count";
import { ProjectLabel } from "@/components/project-identity";
import { RoundJoinCta } from "@/components/round-join-cta";
import { RoundStatusBadge } from "@/components/round-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { roundCta } from "@/lib/round-cta";
import { FORMAT_LABELS } from "@/lib/round-fields";
import { roundHref, roundParams } from "@/lib/round-links";
import { useNearAccountStatus } from "@/lib/use-near-account";

type RoundDetail = Awaited<ReturnType<ApiClient["listRounds"]>>[number];

/** Columns that collapse on narrow screens; the title column is always visible. */
const COLUMN_VISIBILITY: Record<string, string> = {
  project: "",
  title: "",
  status: "",
  formats: "hidden lg:table-cell",
  participantCount: "hidden md:table-cell",
  endorsements: "hidden md:table-cell",
  actions: "",
};

const PAGE_SIZE = 10;

interface RoundsTableProps {
  rounds: RoundDetail[];
  /** Endorsement counts keyed by round id. */
  endorsements?: Record<string, { totalCount: number }>;
  page: number;
  onPageChange: (page: number) => void;
}

export function RoundsTable({ rounds, endorsements, page, onPageChange }: RoundsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { accountId, isDetecting } = useNearAccountStatus();
  const session = useQuery(sessionQueryOptions(auth));
  const joinedRounds = useQuery({
    ...joinedRoundsQueryOptions(apiClient),
    enabled: !!accountId,
  });
  // One joined-rounds query backs every row, instead of a participation check each.
  const joinedIds = useMemo(
    () => new Set((joinedRounds.data ?? []).map((joined) => joined.roundId)),
    [joinedRounds.data],
  );
  const sessionPending = session.isPending || isDetecting;

  const rowCta = (round: RoundDetail) =>
    roundCta({
      redirectTo: roundHref(round),
      canJoin: round.status === "open" && accountId !== round.ownerAccountId,
      sessionPending,
      signedIn: !!session.data?.user,
      nearAccountId: accountId,
      joined: joinedIds.has(round.id),
    });

  const columns = useMemo<ColumnDef<RoundDetail>[]>(
    () => [
      {
        id: "project",
        header: "Project",
        accessorFn: (round) => (round.identity?.title ?? round.projectSlug).toLowerCase(),
        cell: ({ row }) => (
          <Link to="/projects/$slug" params={{ slug: row.original.projectSlug }}>
            <ProjectLabel
              identity={row.original.identity}
              name={row.original.identity?.title ?? row.original.projectSlug}
              className="hover:underline"
            />
          </Link>
        ),
      },
      {
        id: "title",
        header: "Round",
        accessorFn: (round) => round.title.toLowerCase(),
        cell: ({ row }) => (
          <Link
            to="/projects/$slug/$n"
            params={roundParams(row.original)}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.legionOnly && (
              <LegionMark className="mr-1 inline-block align-[-2px]" title="Legion members only" />
            )}
            <span className="text-muted-foreground">#{row.original.projectRoundNumber}</span>{" "}
            {row.original.title}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => <RoundStatusBadge status={row.original.status} />,
      },
      {
        id: "formats",
        header: "Formats",
        accessorFn: (round) => round.formats.length,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.formats.map((format) => (
              <Badge key={format} variant="outline" className="text-xs">
                {FORMAT_LABELS[format] ?? format}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "participantCount",
        header: "Participants",
        accessorKey: "participantCount",
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.participantCount}
          </span>
        ),
      },
      {
        id: "endorsements",
        header: "Endorsements",
        accessorFn: (round) => endorsements?.[round.id]?.totalCount ?? 0,
        cell: ({ row }) =>
          endorsements?.[row.original.id]?.totalCount ? (
            <EndorsementCount count={endorsements[row.original.id].totalCount} />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const cta = rowCta(row.original);
          if (cta.kind === "none") return null;
          // A Legion-gated round needs the full SBT check, which only the round
          // page renders — send the tester there to join.
          if (cta.kind === "join" && row.original.legionOnly) {
            return (
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/$slug/$n" params={roundParams(row.original)}>
                  view to join
                </Link>
              </Button>
            );
          }
          return <RoundJoinCta round={row.original} cta={cta} size="sm" />;
        },
      },
    ],
    [endorsements, accountId, sessionPending, session.data?.user, joinedIds],
  );

  const table = useReactTable({
    data: rounds,
    columns,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const current = { pageIndex: page - 1, pageSize: PAGE_SIZE };
      const next = typeof updater === "function" ? updater(current) : updater;
      onPageChange(next.pageIndex + 1);
    },
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="space-y-3" data-testid="rounds-table">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const SortIcon =
                  sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                return (
                  <TableHead key={header.id} className={COLUMN_VISIBILITY[header.column.id]}>
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        aria-label={`Sort by ${String(header.column.columnDef.header)}`}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <SortIcon className="h-3 w-3 opacity-60" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={COLUMN_VISIBILITY[cell.column.id]}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
