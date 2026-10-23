import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { SortingState } from "@tanstack/react-table";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { type ApiClient, sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Badge, Button, LegionMark } from "@/components";
import { EndorsementCount } from "@/components/endorsement-count";
import { ProjectLabel } from "@/components/project-identity";
import { RoundJoinCta } from "@/components/round-join-cta";
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
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { roundCta } from "@/lib/round-cta";
import { isRoundAcceptingFeedback } from "@/lib/round-expiry";
import { FORMAT_LABELS } from "@/lib/round-fields";
import { roundHref, roundParams } from "@/lib/round-links";
import { useNearAccountStatus } from "@/lib/use-near-account";

type RoundDetail = Awaited<ReturnType<ApiClient["listRounds"]>>[number];

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

const columnHelper = createColumnHelper<typeof features, RoundDetail>();

export const ROUNDS_PAGE_SIZE = 10;

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
      canJoin: isRoundAcceptingFeedback(round) && accountId !== round.ownerAccountId,
      sessionPending,
      signedIn: !!session.data?.user,
      nearAccountId: accountId,
      joined: joinedIds.has(round.id),
    });

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor(
          (round) => (round.identity?.title ?? round.projectSlug).toLowerCase(),
          {
            id: "project",
            header: "Project",
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
        ),
        columnHelper.accessor((round) => round.title.toLowerCase(), {
          id: "title",
          header: "Round",
          cell: ({ row }) => (
            <Link
              to="/projects/$slug/$n"
              params={roundParams(row.original)}
              className="font-medium text-foreground hover:underline"
            >
              {row.original.legionOnly && (
                <LegionMark
                  className="mr-1 inline-block align-[-2px]"
                  title="Legion members only"
                />
              )}
              <RoundListTitle
                title={row.original.title}
                projectRoundNumber={row.original.projectRoundNumber}
              />
            </Link>
          ),
        }),
        columnHelper.accessor("status", {
          id: "status",
          header: "Status",
          cell: ({ row }) => <RoundStatusBadge status={row.original.status} />,
        }),
        columnHelper.accessor((round) => round.formats.length, {
          id: "formats",
          header: "Formats",
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-1.5">
              {row.original.formats.map((format) => (
                <Badge key={format} variant="outline" className="text-xs">
                  {FORMAT_LABELS[format] ?? format}
                </Badge>
              ))}
            </div>
          ),
        }),
        columnHelper.accessor("participantCount", {
          id: "participantCount",
          header: "Participants",
          cell: ({ row }) => (
            <span className="tabular-nums text-muted-foreground">
              {row.original.participantCount}
            </span>
          ),
        }),
        columnHelper.accessor((round) => endorsements?.[round.id]?.totalCount ?? 0, {
          id: "endorsements",
          header: "Endorsements",
          cell: ({ row }) =>
            endorsements?.[row.original.id]?.totalCount ? (
              <EndorsementCount count={endorsements[row.original.id].totalCount} />
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        }),
        columnHelper.display({
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
        }),
      ]),
    [endorsements, accountId, sessionPending, session.data?.user, joinedIds],
  );

  const table = useTable({
    features,
    columns,
    data: rounds,
    state: { sorting, pagination: { pageIndex: page - 1, pageSize: ROUNDS_PAGE_SIZE } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const current = { pageIndex: page - 1, pageSize: ROUNDS_PAGE_SIZE };
      const next = typeof updater === "function" ? updater(current) : updater;
      onPageChange(next.pageIndex + 1);
    },
    autoResetPageIndex: false,
  });

  const { pageIndex } = table.state.pagination;
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
