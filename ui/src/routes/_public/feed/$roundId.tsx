import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MessageSquare, Share2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  FieldLabel,
  Input,
  SegmentedToggle,
  Skeleton,
  Textarea,
} from "@/components";
import { BroadcastPanel } from "@/components/broadcast-panel";
import { EndorsementCount } from "@/components/endorsement-count";
import { FeedbackTable } from "@/components/feedback-table";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/section-header";
import { RoundReadme } from "@/components/round-readme";
import { roundActivityUrl } from "@/lib/activity-events";
import { pageHead } from "@/lib/page-title";
import { roundCta } from "@/lib/round-cta";
import { useNearAccountStatus } from "@/lib/use-near-account";

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "default",
  open: "secondary",
  closed: "outline",
  rejected: "destructive",
};

type FeedbackFormat = "written" | "recorded";

const FEEDBACK_BODY_MAX = 5000;

export const Route = createFileRoute("/_public/feed/$roundId")({
  head: ({ params }) => pageHead("Round", `Feedback round ${params.roundId}.`),
  component: RoundDetailPage,
});

const FORMAT_LABELS: Record<string, string> = {
  issues: "GitHub issues",
  written: "Written feedback",
  recorded: "Recorded session",
};

const FORMAT_HINTS: Record<FeedbackFormat, string> = {
  written:
    "Write up what you tried, what worked, and what didn't. It's posted publicly on the round.",
  recorded: "Paste a link to your session recording — Loom, YouTube, anything viewable.",
};

type FeedbackDraft = { body: string; url: string };

const EMPTY_DRAFT: FeedbackDraft = { body: "", url: "" };

async function shareRound(title: string) {
  const url = window.location.href;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(url);
  toast.success("Link copied");
}

function RoundDetailPage() {
  const { roundId } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canGoBack = router.history.canGoBack?.() ?? false;
  const { accountId: nearAccountId, isDetecting: isNearDetecting } = useNearAccountStatus();
  const sessionQuery = useQuery(sessionQueryOptions(auth));
  const isAdmin = sessionQuery.data?.user?.role === "admin";

  const roundQuery = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => apiClient.getRound({ id: roundId }),
  });

  const participationQuery = useQuery({
    queryKey: ["round", roundId, "participation"],
    queryFn: () => apiClient.getMyParticipation({ id: roundId }),
    enabled: !!nearAccountId,
  });

  const endorsementsQuery = useQuery({
    queryKey: ["activity", "endorsements", [roundId]],
    queryFn: () => apiClient.getRoundEndorsements({ roundIds: [roundId] }),
    staleTime: 60_000,
  });
  const endorsement = endorsementsQuery.data?.[roundId];

  const round = roundQuery.data;
  const joined = participationQuery.data?.joined ?? false;

  const joinMutation = useMutation({
    mutationFn: (next: boolean) =>
      next ? apiClient.joinRound({ id: roundId }) : apiClient.leaveRound({ id: roundId }),
    onSuccess: (detail, next) => {
      queryClient.setQueryData(["round", roundId], detail);
      queryClient.setQueryData(["round", roundId, "participation"], { joined: next });
      void queryClient.invalidateQueries({ queryKey: ["myRounds"] });
      toast.success(next ? "Joined the round" : "Left the round");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (roundQuery.isLoading) {
    return (
      <PageContainer variant="default">
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!round) {
    return (
      <PageContainer variant="default">
        <EmptyState
          title="Round not found."
          action={
            <Link to="/feed" className="text-sm text-muted-foreground underline">
              back to the feed
            </Link>
          }
        />
      </PageContainer>
    );
  }

  // The project's owning org manages the round (#70). Its members don't join it as testers.
  const canManage = round.canManage ?? false;
  const isOwner = !!nearAccountId && nearAccountId === round.ownerAccountId;
  const canJoin = round.status === "open" && !isOwner && !canManage;
  const cta = roundCta({
    roundId,
    canJoin,
    sessionPending: sessionQuery.isPending || isNearDetecting,
    signedIn: !!sessionQuery.data?.user,
    nearAccountId: nearAccountId || null,
    joined,
  });

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-3">
          {canGoBack ? (
            <button
              type="button"
              aria-label="Go back"
              onClick={() => router.history.back()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/feed"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              feed
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={() => void shareRound(round.title)}>
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        </div>

        <PageHeader
          icon={MessageSquare}
          label="Feedback Rounds"
          title={round.title}
          subtitle={round.projectSlug}
          actions={
            <Badge variant={STATUS_BADGE_VARIANT[round.status] ?? "outline"}>{round.status}</Badge>
          }
        />

        <RoundReadme roundId={roundId} readme={round.readme} canEdit={canManage} />

        <p className="text-sm text-foreground whitespace-pre-wrap">{round.description}</p>

        {endorsement && (
          <div className="flex flex-wrap items-center gap-3">
            <EndorsementCount count={endorsement.totalCount} />
            <a
              href={roundActivityUrl(round.ownerAccountId)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground underline"
            >
              Endorse on activity
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {round.formats.map((format) => (
            <Badge key={format} variant="outline" className="text-xs">
              {FORMAT_LABELS[format] ?? format}
            </Badge>
          ))}
        </div>

        {round.repoUrl && (
          <a
            href={round.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline break-all"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {round.repoUrl}
          </a>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {round.participantCount} {round.participantCount === 1 ? "builder" : "builders"} joined
          </span>

          {(cta.kind === "join" || cta.kind === "leave") && (
            <Button
              variant={cta.kind === "leave" ? "outline" : "default"}
              onClick={() => joinMutation.mutate(cta.kind === "join")}
              disabled={joinMutation.isPending || participationQuery.isLoading}
            >
              {cta.kind === "leave" ? "Leave round" : "Join round"}
            </Button>
          )}
          {cta.kind === "signin" && (
            <Link
              to={cta.loginTo.to}
              search={cta.loginTo.search}
              className="text-sm text-foreground underline"
            >
              Sign in to join
            </Link>
          )}
          {cta.kind === "link-account" && (
            <Link to="/settings/auth-methods" className="text-sm text-foreground underline">
              Link a NEAR account to join
            </Link>
          )}
        </div>

        {isAdmin && round.status === "pending" && (
          <AdminReviewPanel roundId={roundId} projectRecordId={round.projectRecordId} />
        )}

        {!isAdmin && canManage && round.status === "pending" && (
          <Card className="p-4 space-y-1 border-t border-border">
            <span className="text-sm font-medium text-foreground">Awaiting project approval</span>
            <p className="text-xs text-muted-foreground">
              An admin will approve or reject this project before its rounds are visible to
              builders.
            </p>
          </Card>
        )}

        {(canManage || isAdmin) && round.status === "rejected" && (
          <Card className="p-4 space-y-1 border-t border-border">
            <span className="text-sm font-medium text-foreground">
              This project request was rejected
            </span>
            {round.rejectionReason && (
              <p className="text-sm text-foreground">{round.rejectionReason}</p>
            )}
          </Card>
        )}

        {(canManage || isAdmin) && round.status === "open" && (
          <BroadcastPanel roundId={roundId} participantCount={round.participantCount} />
        )}

        {canManage && round.status === "open" && <OwnerClosePanel roundId={roundId} />}

        {round.status === "closed" && <CreditsSection roundId={roundId} />}

        <FeedbackThread
          roundId={roundId}
          formats={round.formats}
          repoUrl={round.repoUrl}
          canPost={joined && round.status === "open"}
          canDelete={round.status === "open"}
          canModerate={canManage || isAdmin}
        />
      </div>
    </PageContainer>
  );
}

function FeedbackThread({
  roundId,
  formats,
  repoUrl,
  canPost,
  canDelete,
  canModerate,
}: {
  roundId: string;
  formats: string[];
  repoUrl?: string | null;
  canPost: boolean;
  canDelete: boolean;
  canModerate: boolean;
}) {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const nearAccountId = auth.near.getAccountId();

  const writableFormats = formats.filter(
    (f): f is FeedbackFormat => f === "written" || f === "recorded",
  );
  const [format, setFormat] = useState<FeedbackFormat>(writableFormats[0] ?? "written");
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const draftKey = `feedback-draft:${roundId}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FeedbackDraft>;
        setDraft({ body: parsed.body ?? "", url: parsed.url ?? "" });
      }
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft.body || draft.url) {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } else {
        localStorage.removeItem(draftKey);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, draftKey]);

  const feedbackQuery = useQuery({
    queryKey: ["round", roundId, "feedback"],
    queryFn: () => apiClient.listFeedback({ id: roundId }),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.postFeedback({
        id: roundId,
        format,
        body: format === "written" ? draft.body.trim() : undefined,
        url: format === "recorded" ? draft.url.trim() : undefined,
      }),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      localStorage.removeItem(draftKey);
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "feedback"] });
      toast.success("Feedback posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (feedbackId: string) => apiClient.deleteFeedback({ id: roundId, feedbackId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "feedback"] });
      toast.success("Feedback deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const entries = feedbackQuery.data ?? [];
  const canSubmit =
    !postMutation.isPending &&
    (format === "written" ? draft.body.trim().length > 0 : draft.url.trim().length > 0) &&
    writableFormats.includes(format);

  const issuesUrl = repoUrl ? `${repoUrl.replace(/\/+$/, "")}/issues` : null;

  return (
    <div className="space-y-4 border-t border-border pt-8">
      <SectionHeader
        title="Feedback"
        action={
          !feedbackQuery.isLoading && entries.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          ) : undefined
        }
      />

      {formats.includes("issues") && issuesUrl && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            For bugs, file an issue on the project's GitHub so it's tracked where fixes land.{" "}
            <a
              href={issuesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground underline"
            >
              File an issue
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </Card>
      )}

      {canPost && writableFormats.length > 0 && (
        <Card className="p-6 space-y-4">
          {writableFormats.length > 1 && (
            <SegmentedToggle
              value={format}
              onValueChange={setFormat}
              options={writableFormats.map((f) => ({
                value: f,
                label: f === "written" ? "Written" : "Recorded",
              }))}
              ariaLabel="Feedback format"
            />
          )}
          <p className="text-xs text-muted-foreground">{FORMAT_HINTS[format]}</p>
          {format === "written" ? (
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="feedback-body">your feedback</FieldLabel>
                <span className="text-xs text-muted-foreground">
                  {draft.body.length}/{FEEDBACK_BODY_MAX}
                </span>
              </div>
              <Textarea
                id="feedback-body"
                value={draft.body}
                onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
                rows={5}
                maxLength={FEEDBACK_BODY_MAX}
                placeholder="What worked, what didn't?"
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="feedback-url">recording link</FieldLabel>
              <Input
                id="feedback-url"
                type="url"
                value={draft.url}
                onChange={(e) => setDraft((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://..."
              />
            </Field>
          )}
          <Button onClick={() => postMutation.mutate()} disabled={!canSubmit}>
            {postMutation.isPending ? "Posting..." : "Post feedback"}
          </Button>
        </Card>
      )}

      {feedbackQuery.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <FeedbackTable
          roundId={roundId}
          entries={entries}
          canModerate={canModerate}
          currentAccountId={nearAccountId || null}
          canDelete={canDelete}
          onDelete={setDeleteId}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete this feedback?"
        description="Your feedback will be removed from the round. This can't be undone."
        confirmLabel="Delete"
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteId) {
            deleteMutation.mutate(deleteId);
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}

function CreditsSection({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const { data: credits = [], isLoading } = useQuery({
    queryKey: ["round", roundId, "credits"],
    queryFn: () => apiClient.listRoundCredits({ id: roundId }),
  });

  if (isLoading || credits.length === 0) return null;

  return (
    <div className="space-y-3 border-t border-border pt-8">
      <SectionHeader title="Credited contributors" />
      <ul className="space-y-2">
        {credits.map((credit) => (
          <li key={credit.id}>
            <Card className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{credit.builderAccountId}</span>
                {credit.contributedMeaningfully && (
                  <Badge variant="secondary" className="text-[10px]">
                    meaningful
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {credit.writtenCount} written · {credit.recordedCount} recorded
              </p>
              {credit.summary && <p className="text-sm text-foreground">{credit.summary}</p>}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminReviewPanel({
  roundId,
  projectRecordId,
}: {
  roundId: string;
  projectRecordId: string;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const onDecided = (message: string) => {
    void queryClient.invalidateQueries({ queryKey: ["round", roundId] });
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    toast.success(message);
  };

  const approveMutation = useMutation({
    mutationFn: () => apiClient.approveProject({ id: projectRecordId }),
    onSuccess: () => onDecided("Project approved"),
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiClient.rejectProject({ id: projectRecordId, reason: reason.trim() }),
    onSuccess: () => onDecided("Project rejected"),
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card className="p-4 space-y-3 border-t border-border">
      <span className="text-sm font-medium text-foreground">Admin review</span>
      <Field>
        <FieldLabel htmlFor="reject-reason">rejection reason (required to reject)</FieldLabel>
        <Input
          id="reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why isn't this ready?"
          disabled={pending}
        />
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => approveMutation.mutate()} disabled={pending}>
          {approveMutation.isPending ? "Approving..." : "Approve project"}
        </Button>
        <Button
          variant="outline"
          onClick={() => rejectMutation.mutate()}
          disabled={pending || !reason.trim()}
        >
          {rejectMutation.isPending ? "Rejecting..." : "Reject project"}
        </Button>
      </div>
    </Card>
  );
}

function OwnerClosePanel({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, { meaningful: boolean; summary: string }>>({});

  const candidatesQuery = useQuery({
    queryKey: ["round", roundId, "credit-candidates"],
    queryFn: () => apiClient.getCreditCandidates({ id: roundId }),
    enabled: open,
  });

  const closeMutation = useMutation({
    mutationFn: () => {
      const credits = Object.entries(marks)
        .filter(([, m]) => m.meaningful || m.summary.trim())
        .map(([builderAccountId, m]) => ({
          builderAccountId,
          contributedMeaningfully: m.meaningful,
          summary: m.summary.trim() || undefined,
        }));
      return apiClient.closeRound({ id: roundId, credits });
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(["round", roundId], detail);
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "credits"] });
      void queryClient.invalidateQueries({ queryKey: ["myRounds"] });
      toast.success("Round closed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const candidates = candidatesQuery.data ?? [];

  return (
    <Card className="p-4 space-y-3 border-t border-border">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">Close this round</span>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Close round
          </Button>
        )}
      </div>

      {open && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Mark anyone who contributed meaningfully. Only people who posted feedback are listed.
          </p>
          {candidatesQuery.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback was posted.</p>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => {
                const mark = marks[c.accountId] ?? { meaningful: false, summary: "" };
                return (
                  <li
                    key={c.accountId}
                    className="rounded-[10px] border border-border p-3 space-y-2"
                  >
                    <label
                      className="flex items-center gap-2 text-sm"
                      htmlFor={`mark-${c.accountId}`}
                    >
                      <input
                        id={`mark-${c.accountId}`}
                        type="checkbox"
                        checked={mark.meaningful}
                        onChange={(e) =>
                          setMarks((prev) => ({
                            ...prev,
                            [c.accountId]: { ...mark, meaningful: e.target.checked },
                          }))
                        }
                      />
                      <span className="font-mono text-foreground">{c.accountId}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.writtenCount}w · {c.recordedCount}r
                      </span>
                    </label>
                    <Input
                      value={mark.summary}
                      onChange={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [c.accountId]: { ...mark, summary: e.target.value },
                        }))
                      }
                      placeholder="Optional summary"
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex gap-2">
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? "Closing..." : "Confirm close"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={closeMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
