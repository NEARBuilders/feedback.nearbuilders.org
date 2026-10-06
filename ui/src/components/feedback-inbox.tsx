import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Download, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button, Checkbox, ConfirmDialog } from "@/components";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { exportFeedback } from "@/lib/feedback-export";
import { inboxKeyAction, isTypingTarget } from "@/lib/inbox-keys";
import type { FeedbackEntry, FeedbackStatus } from "@/lib/queries/feedback";
import type { RoundParams } from "@/lib/round-links";
import { useSetFeedbackStatus } from "@/lib/use-feedback-status";
import { cn } from "@/lib/utils";

type BulkStatus = Exclude<FeedbackStatus, "unresolved">;

const BULK_VERBS: Record<BulkStatus, string> = { resolved: "Resolve", dismissed: "Dismiss" };

interface FeedbackInboxProps {
  roundId: string;
  params: RoundParams;
  entries: FeedbackEntry[];
  openId: string | undefined;
  footer?: ReactNode;
}

export function feedbackSnippet(entry: FeedbackEntry): string {
  return (entry.format === "written" ? entry.body : entry.url) ?? "";
}

export function FeedbackInbox({ roundId, params, entries, openId, footer }: FeedbackInboxProps) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<BulkStatus | null>(null);
  const statusMutation = useSetFeedbackStatus(roundId);
  const { mutate: setStatus } = statusMutation;

  useEffect(() => {
    const ids = entries.map((entry) => entry.id);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const action = inboxKeyAction(event.key, ids, openId);
      if (!action) return;
      event.preventDefault();
      if (action.type === "open") {
        void navigate({
          to: "/manage/$slug/$n/$feedbackId",
          params: { ...params, feedbackId: action.id },
          search: true,
        });
      } else setStatus({ feedbackIds: [action.id], status: action.status });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entries, openId, navigate, params, setStatus]);

  const selection = entries.filter((entry) => selected.has(entry.id));
  const allSelected = entries.length > 0 && selection.length === entries.length;

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const exportSelection = (kind: "csv" | "json") =>
    exportFeedback(kind, `feedback-${params.slug}-${params.n}`, selection);

  return (
    <div className="space-y-3" data-testid="feedback-inbox">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <Checkbox
          aria-label="Select all loaded feedback"
          checked={allSelected ? true : selection.length > 0 ? "indeterminate" : false}
          onCheckedChange={(checked) =>
            setSelected(new Set(checked === true ? entries.map((entry) => entry.id) : []))
          }
        />
        {selection.length > 0 ? (
          <>
            <span className="text-sm text-muted-foreground">{selection.length} selected</span>
            <Button variant="outline" size="sm" onClick={() => setPendingBulk("resolved")}>
              <Check className="h-3.5 w-3.5" />
              resolve
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPendingBulk("dismissed")}>
              <X className="h-3.5 w-3.5" />
              dismiss
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportSelection("csv")}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => exportSelection("json")}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">j/k to move · r resolve · d dismiss</span>
        )}
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={cn("flex items-start gap-3 px-3 py-2.5", entry.id === openId && "bg-accent")}
          >
            <Checkbox
              className="mt-1"
              aria-label={`Select feedback from ${entry.authorAccountId}`}
              checked={selected.has(entry.id)}
              onCheckedChange={(checked) => toggle(entry.id, checked === true)}
            />
            <Link
              to="/manage/$slug/$n/$feedbackId"
              params={{ ...params, feedbackId: entry.id }}
              search
              className="block min-w-0 flex-1 space-y-1"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {entry.authorAccountId}
                </span>
                <FeedbackStatusBadge status={entry.status} />
              </span>
              <span className="line-clamp-2 text-sm text-foreground break-words">
                {feedbackSnippet(entry)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {footer}

      <ConfirmDialog
        open={pendingBulk !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBulk(null);
        }}
        title={`${pendingBulk ? BULK_VERBS[pendingBulk] : ""} ${selection.length} ${
          selection.length === 1 ? "item" : "items"
        }?`}
        description={`The selected feedback will be marked ${pendingBulk ?? ""}.`}
        confirmLabel={pendingBulk ? BULK_VERBS[pendingBulk] : "Confirm"}
        isPending={statusMutation.isPending}
        onConfirm={() => {
          if (pendingBulk) {
            setStatus(
              { feedbackIds: selection.map((entry) => entry.id), status: pendingBulk },
              {
                onSuccess: () => {
                  setSelected(new Set());
                  setPendingBulk(null);
                },
              },
            );
          }
        }}
      />
    </div>
  );
}
