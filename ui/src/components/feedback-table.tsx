import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Download,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import { Badge, Button, Checkbox } from "@/components";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SegmentedToggle } from "@/components/segmented-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadTextFile,
  type FeedbackStatus,
  type FeedbackStatusFilter,
  feedbackToCsv,
  feedbackToJson,
  filterFeedbackByStatus,
} from "@/lib/feedback-export";

type FeedbackEntry = Awaited<ReturnType<ApiClient["listFeedback"]>>[number];

const STATUS_FILTERS: Array<{ value: FeedbackStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
  { value: "starred", label: "Starred" },
];

const STATUS_BADGE_VARIANT: Record<FeedbackStatus, "secondary" | "success" | "outline"> = {
  unresolved: "secondary",
  resolved: "success",
  dismissed: "outline",
};

const BULK_VERBS: Record<Exclude<FeedbackStatus, "unresolved">, string> = {
  resolved: "Resolve",
  dismissed: "Dismiss",
};

const COLUMN_VISIBILITY: Record<string, string> = {
  select: "w-10",
  author: "hidden sm:table-cell",
  format: "hidden md:table-cell",
  content: "",
  createdAt: "hidden md:table-cell",
  status: "",
  actions: "",
};

interface FeedbackTableProps {
  roundId: string;
  entries: FeedbackEntry[];
  canModerate: boolean;
  currentAccountId: string | null;
  canDelete: boolean;
  onDelete: (feedbackId: string) => void;
}

export function FeedbackTable({
  roundId,
  entries,
  canModerate,
  currentAccountId,
  canDelete,
  onDelete,
}: FeedbackTableProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FeedbackStatusFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingBulk, setPendingBulk] = useState<Exclude<FeedbackStatus, "unresolved"> | null>(
    null,
  );

  const visibleEntries = useMemo(() => filterFeedbackByStatus(entries, filter), [entries, filter]);

  useEffect(() => {
    setRowSelection({});
  }, [filter]);

  const statusMutation = useMutation({
    mutationFn: (input: { feedbackIds: string[]; status: FeedbackStatus }) =>
      apiClient.setFeedbackStatus({ id: roundId, ...input }),
    onSuccess: (updated, { status }) => {
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "feedback"] });
      setRowSelection({});
      setPendingBulk(null);
      toast.success(
        updated.length === 1 ? `Marked ${status}` : `Marked ${updated.length} items ${status}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: setStatus, isPending: isStatusPending } = statusMutation;

  const starMutation = useMutation({
    mutationFn: (input: { feedbackIds: string[]; starred: boolean }) =>
      apiClient.setFeedbackStarred({ id: roundId, ...input }),
    onSuccess: (updated, { starred }) => {
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "feedback"] });
      setRowSelection({});
      toast.success(
        updated.length === 1
          ? starred
            ? "Starred"
            : "Star removed"
          : `${starred ? "Starred" : "Unstarred"} ${updated.length} items`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: setStarred, isPending: isStarPending } = starMutation;

  const columns = useMemo<ColumnDef<FeedbackEntry>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all feedback"
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select feedback from ${row.original.authorAccountId}`}
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          />
        ),
      },
      {
        id: "author",
        header: "Author",
        accessorKey: "authorAccountId",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">{row.original.authorAccountId}</span>
        ),
      },
      {
        id: "format",
        header: "Format",
        accessorKey: "format",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {row.original.format === "written" ? "Written" : "Recorded"}
          </Badge>
        ),
      },
      {
        id: "content",
        header: "Feedback",
        enableSorting: false,
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="space-y-1 min-w-48">
              {entry.format === "written" ? (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {entry.body}
                </p>
              ) : (
                entry.url && (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground underline break-all"
                  >
                    {entry.url}
                  </a>
                )
              )}
              {entry.starredAt && (
                <Badge variant="secondary" className="gap-1 text-[10px]" data-testid="star-badge">
                  <Star className="h-3 w-3 fill-current" />
                  Standout
                </Badge>
              )}
              <p className="text-xs text-muted-foreground sm:hidden">
                <span className="font-mono">{entry.authorAccountId}</span>
                {entry.authorAccountId === currentAccountId && " (you)"}
              </p>
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Date",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_VARIANT[row.original.status]} className="text-[10px]">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const entry = row.original;
          const isOwn = !!currentAccountId && entry.authorAccountId === currentAccountId;
          return (
            <div className="flex items-center justify-end gap-1">
              {canModerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={entry.starredAt ? "Remove star" : "Star as standout"}
                  aria-pressed={!!entry.starredAt}
                  disabled={isStarPending}
                  onClick={() => setStarred({ feedbackIds: [entry.id], starred: !entry.starredAt })}
                >
                  <Star className={`h-3.5 w-3.5 ${entry.starredAt ? "fill-current" : ""}`} />
                </Button>
              )}
              {canModerate && entry.status !== "resolved" && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Mark resolved"
                  disabled={isStatusPending}
                  onClick={() => setStatus({ feedbackIds: [entry.id], status: "resolved" })}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              {canModerate && entry.status !== "dismissed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Dismiss"
                  disabled={isStatusPending}
                  onClick={() => setStatus({ feedbackIds: [entry.id], status: "dismissed" })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              {canModerate && entry.status !== "unresolved" && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Reopen"
                  disabled={isStatusPending}
                  onClick={() => setStatus({ feedbackIds: [entry.id], status: "unresolved" })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              {isOwn && canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete feedback"
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [
      canModerate,
      canDelete,
      currentAccountId,
      onDelete,
      setStatus,
      isStatusPending,
      setStarred,
      isStarPending,
    ],
  );

  const table = useReactTable({
    data: visibleEntries,
    columns,
    state: { sorting, rowSelection },
    getRowId: (entry) => entry.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  const exportSelection = (kind: "csv" | "json") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      downloadTextFile(`feedback-${roundId}-${stamp}.csv`, feedbackToCsv(selected), "text/csv");
    } else {
      downloadTextFile(
        `feedback-${roundId}-${stamp}.json`,
        feedbackToJson(selected),
        "application/json",
      );
    }
  };

  return (
    <div className="space-y-3" data-testid="feedback-table">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto">
          <SegmentedToggle
            value={filter}
            onValueChange={setFilter}
            options={STATUS_FILTERS}
            ariaLabel="Filter feedback by status"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.length} selected</span>
            {canModerate && (
              <>
                <Button variant="outline" size="sm" onClick={() => setPendingBulk("resolved")}>
                  <Check className="h-3.5 w-3.5" />
                  Resolve
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingBulk("dismissed")}>
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isStarPending}
                  onClick={() =>
                    setStarred({ feedbackIds: selected.map((entry) => entry.id), starred: true })
                  }
                >
                  <Star className="h-3.5 w-3.5" />
                  Star
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isStarPending}
                  onClick={() =>
                    setStarred({ feedbackIds: selected.map((entry) => entry.id), starred: false })
                  }
                >
                  Unstar
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => exportSelection("csv")}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSelection("json")}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
        )}
      </div>

      {visibleEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "all"
            ? "No feedback yet."
            : filter === "starred"
              ? "No starred feedback."
              : `No ${filter} feedback.`}
        </p>
      ) : (
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
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className={COLUMN_VISIBILITY[cell.column.id]}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={pendingBulk !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBulk(null);
        }}
        title={`${pendingBulk ? BULK_VERBS[pendingBulk] : ""} ${selected.length} ${
          selected.length === 1 ? "item" : "items"
        }?`}
        description={`The selected feedback will be marked ${pendingBulk ?? ""} and the new status is visible to everyone in the round.`}
        confirmLabel={pendingBulk ? BULK_VERBS[pendingBulk] : "Confirm"}
        isPending={statusMutation.isPending}
        onConfirm={() => {
          if (pendingBulk) {
            statusMutation.mutate({
              feedbackIds: selected.map((entry) => entry.id),
              status: pendingBulk,
            });
          }
        }}
      />
    </div>
  );
}
