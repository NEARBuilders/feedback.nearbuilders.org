import { Trash2 } from "lucide-react";
import { Button } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { FeedbackContent } from "@/components/feedback-content";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import type { FeedbackEntry } from "@/lib/queries/feedback";

interface FeedbackListProps {
  entries: FeedbackEntry[];
  currentAccountId: string | null;
  onDelete?: (feedbackId: string) => void;
}

export function FeedbackList({ entries, currentAccountId, onDelete }: FeedbackListProps) {
  return (
    <ul className="space-y-3" data-testid="feedback-list">
      {entries.map((entry) => {
        const isOwn = entry.authorAccountId === currentAccountId;
        return (
          <li key={entry.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <AccountAvatar accountId={entry.authorAccountId} />
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {entry.authorAccountId}
                  {isOwn && " (you)"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
                <FeedbackStatusBadge status={entry.status} />
                {isOwn && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete feedback"
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </span>
            </div>
            <FeedbackContent entry={entry} />
          </li>
        );
      })}
    </ul>
  );
}
