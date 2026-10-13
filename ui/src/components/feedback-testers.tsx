import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Copy, MessageSquare, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Skeleton } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { FeedbackContent } from "@/components/feedback-content";
import { StarBadge } from "@/components/feedback-star-badge";
import { FeedbackStatusActions } from "@/components/feedback-status-actions";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { LoadMoreButton } from "@/components/load-more-button";
import { TipButtons } from "@/components/tip-tester";
import { type FeedbackTester, type TesterFilter, testerState } from "@/lib/feedback-testers";
import { roundFeedbackQueryOptions } from "@/lib/queries/feedback";
import type { RoundParams } from "@/lib/round-links";
import { useSetFeedbackStarred, useSetFeedbackStatus } from "@/lib/use-feedback-status";
import { cn } from "@/lib/utils";

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

function TelegramLink({ handle, className }: { handle: string | null; className?: string }) {
  if (!handle) {
    return <span className={cn("text-xs text-muted-foreground", className)}>no Telegram</span>;
  }
  return (
    <a
      href={`https://t.me/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "text-xs text-muted-foreground hover:text-foreground hover:underline",
        className,
      )}
      data-testid="tester-telegram"
    >
      @{handle}
    </a>
  );
}

function TesterStateBadge({ tester }: { tester: FeedbackTester }) {
  const done = testerState(tester) === "done";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
        done ? "border-border text-muted-foreground" : "border-foreground text-foreground",
      )}
    >
      {done ? <Check className="h-3 w-3" /> : null}
      {done ? "done" : `${tester.unresolvedCount} open`}
    </span>
  );
}

interface FeedbackTesterListProps {
  testers: FeedbackTester[];
  openAccountId: string | undefined;
  params: RoundParams;
  filter: TesterFilter;
}

export function FeedbackTesterList({
  testers,
  openAccountId,
  params,
  filter,
}: FeedbackTesterListProps) {
  return (
    <ul
      className="divide-y divide-border rounded-lg border border-border"
      data-testid="tester-list"
    >
      {testers.map((tester) => (
        <li
          key={tester.accountId}
          className={cn(tester.accountId === openAccountId && "bg-accent")}
        >
          <Link
            to="/manage/$slug/$n/testers"
            params={params}
            search={{ status: filter, account: tester.accountId }}
            className="flex items-center gap-3 px-3 py-2.5"
          >
            <AccountAvatar accountId={tester.accountId} className="h-8 w-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-sm text-foreground">
                {tester.accountId}
              </span>
              <TelegramLink handle={tester.telegramHandle} className="block truncate" />
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <TesterStateBadge tester={tester} />
              <span className="text-xs text-muted-foreground">
                {tester.feedbackCount} {tester.feedbackCount === 1 ? "post" : "posts"}
                {tester.starredCount > 0 ? ` · ${tester.starredCount} starred` : ""}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface FeedbackTesterPanelProps {
  roundId: string;
  params: RoundParams;
  tester: FeedbackTester;
  filter: TesterFilter;
}

export function FeedbackTesterPanel({ roundId, params, tester, filter }: FeedbackTesterPanelProps) {
  const apiClient = useApiClient();
  const feedbackQuery = useInfiniteQuery(
    roundFeedbackQueryOptions(apiClient, roundId, { author: tester.accountId }),
  );
  const statusMutation = useSetFeedbackStatus(roundId);
  const starMutation = useSetFeedbackStarred(roundId);
  const entries = feedbackQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const openIds = entries.filter((entry) => entry.status === "unresolved").map((entry) => entry.id);

  return (
    <Card className="p-5 space-y-5" data-testid="tester-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/manage/$slug/$n/testers"
            params={params}
            search={{ status: filter }}
            aria-label="Back to testers"
            className="text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <AccountAvatar accountId={tester.accountId} className="h-10 w-10" />
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1">
              <Link
                to="/$accountId"
                params={{ accountId: tester.accountId }}
                className="truncate font-mono text-sm text-foreground hover:underline"
              >
                {tester.accountId}
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy wallet address"
                onClick={() => void copyText("wallet address", tester.accountId)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <TelegramLink handle={tester.telegramHandle} />
              {tester.telegramHandle && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Copy Telegram handle"
                  onClick={() => void copyText("Telegram handle", `@${tester.telegramHandle}`)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {tester.feedbackCount} {tester.feedbackCount === 1 ? "post" : "posts"} · last{" "}
              {new Date(tester.lastPostedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TipButtons accountId={tester.accountId} />
          <Button
            size="sm"
            disabled={openIds.length === 0 || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ feedbackIds: openIds, status: "resolved" })}
            data-testid="resolve-all"
          >
            <Check className="h-3.5 w-3.5" />
            resolve all{openIds.length > 0 ? ` (${openIds.length})` : ""}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={openIds.length === 0 || statusMutation.isPending}
            onClick={() => statusMutation.mutate({ feedbackIds: openIds, status: "dismissed" })}
          >
            <X className="h-3.5 w-3.5" />
            dismiss all
          </Button>
        </div>
      </div>

      {feedbackQuery.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : feedbackQuery.isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load this tester's feedback.</p>
      ) : (
        <ol className="space-y-4">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              className="space-y-3 rounded-lg border border-border p-4"
              data-testid="tester-feedback"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  #{entries.length - index} · {new Date(entry.createdAt).toLocaleString()} ·{" "}
                  {entry.format}
                </span>
                <span className="flex items-center gap-1">
                  {entry.starredAt && <StarBadge />}
                  <FeedbackStatusBadge status={entry.status} />
                </span>
              </div>
              <FeedbackContent entry={entry} />
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <FeedbackStatusActions
                  current={entry.status}
                  disabled={statusMutation.isPending}
                  onChange={(status) => statusMutation.mutate({ feedbackIds: [entry.id], status })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={!!entry.starredAt}
                  disabled={starMutation.isPending}
                  onClick={() =>
                    starMutation.mutate({ feedbackIds: [entry.id], starred: !entry.starredAt })
                  }
                >
                  <Star className={cn("h-3.5 w-3.5", entry.starredAt && "fill-current")} />
                  {entry.starredAt ? "unstar" : "star"}
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link
                    to="/manage/$slug/$n/$feedbackId"
                    params={{ ...params, feedbackId: entry.id }}
                    search={{ status: "all", author: tester.accountId }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    notes
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <LoadMoreButton query={feedbackQuery} />
    </Card>
  );
}
