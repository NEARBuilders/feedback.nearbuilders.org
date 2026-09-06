import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient, useAuthClient } from "@/app";
import { Badge, Button, Card, Field, FieldLabel, Input, Textarea } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

type FeedbackFormat = "written" | "recorded";

export const Route = createFileRoute("/_layout/feedback/$roundId")({
  head: ({ params }) => ({
    meta: [
      { title: "Feedback Round" },
      { name: "description", content: `Detail view for round ${params.roundId}.` },
    ],
  }),
  component: RoundDetailPage,
});

const FORMAT_LABELS: Record<string, string> = {
  issues: "GitHub issues",
  written: "Written feedback",
  recorded: "Recorded session",
};

function RoundDetailPage() {
  const { roundId } = Route.useParams();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const canGoBack = router.history.canGoBack?.() ?? false;
  const nearAccountId = auth.near.getAccountId();

  const roundQuery = useQuery({
    queryKey: ["round", roundId],
    queryFn: () => apiClient.getRound({ id: roundId }),
  });

  const participationQuery = useQuery({
    queryKey: ["round", roundId, "participation"],
    queryFn: () => apiClient.getMyParticipation({ id: roundId }),
    enabled: !!nearAccountId,
  });

  const round = roundQuery.data;
  const joined = participationQuery.data?.joined ?? false;

  const joinMutation = useMutation({
    mutationFn: (next: boolean) =>
      next ? apiClient.joinRound({ id: roundId }) : apiClient.leaveRound({ id: roundId }),
    onSuccess: (detail, next) => {
      queryClient.setQueryData(["round", roundId], detail);
      queryClient.setQueryData(["round", roundId, "participation"], { joined: next });
      toast.success(next ? "Joined the round" : "Left the round");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (roundQuery.isLoading) {
    return (
      <PageContainer variant="narrow">
        <div className="space-y-3 py-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!round) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <p className="text-base font-semibold text-foreground">Round not found.</p>
        <Link to="/feedback" className="text-sm text-muted-foreground underline">
          back to feedback rounds
        </Link>
      </div>
    );
  }

  const isOwner = !!nearAccountId && nearAccountId === round.ownerAccountId;
  const canJoin = round.status === "open" && !isOwner;

  return (
    <PageContainer variant="narrow">
      <div className="space-y-6 py-6">
        <div className="flex items-center gap-3">
          {canGoBack && (
            <button
              type="button"
              onClick={() => router.history.back()}
              className="flex items-center justify-center w-8 h-8 border-2 border-outset border-border-strong bg-card shadow-sm rounded-[10px] hover:bg-muted"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <Badge variant={round.status === "open" ? "secondary" : "outline"}>{round.status}</Badge>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{round.title}</h1>
          <p className="text-xs font-mono text-muted-foreground">{round.projectSlug}</p>
        </div>

        <p className="text-sm text-foreground whitespace-pre-wrap">{round.description}</p>

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
            className="text-sm text-foreground underline"
          >
            {round.repoUrl}
          </a>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {round.participantCount} {round.participantCount === 1 ? "builder" : "builders"} joined
          </span>

          {canJoin && nearAccountId && (
            <Button
              variant={joined ? "outline" : "default"}
              onClick={() => joinMutation.mutate(!joined)}
              disabled={joinMutation.isPending || participationQuery.isLoading}
            >
              {joined ? "Leave round" : "Join round"}
            </Button>
          )}
          {canJoin && !nearAccountId && (
            <Link to="/settings/auth-methods" className="text-sm text-foreground underline">
              Link a NEAR account to join
            </Link>
          )}
        </div>

        <FeedbackThread
          roundId={roundId}
          formats={round.formats.filter(
            (f): f is FeedbackFormat => f === "written" || f === "recorded",
          )}
          canPost={joined && round.status === "open"}
        />
      </div>
    </PageContainer>
  );
}

function FeedbackThread({
  roundId,
  formats,
  canPost,
}: {
  roundId: string;
  formats: FeedbackFormat[];
  canPost: boolean;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<FeedbackFormat>(formats[0] ?? "written");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  const feedbackQuery = useQuery({
    queryKey: ["round", roundId, "feedback"],
    queryFn: () => apiClient.listFeedback({ id: roundId }),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.postFeedback({
        id: roundId,
        format,
        body: format === "written" ? body.trim() : undefined,
        url: format === "recorded" ? url.trim() : undefined,
      }),
    onSuccess: () => {
      setBody("");
      setUrl("");
      void queryClient.invalidateQueries({ queryKey: ["round", roundId, "feedback"] });
      toast.success("Feedback posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const entries = feedbackQuery.data ?? [];
  const canSubmit =
    !postMutation.isPending &&
    (format === "written" ? !!body.trim() : !!url.trim()) &&
    formats.includes(format);

  return (
    <div className="space-y-4 border-t border-border pt-6">
      <h2 className="text-lg font-semibold text-foreground">Feedback</h2>

      {canPost && formats.length > 0 && (
        <Card className="p-4 space-y-3">
          {formats.length > 1 && (
            <div className="flex gap-1.5">
              {formats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`rounded-[8px] border-2 px-3 py-1 text-xs font-medium ${
                    format === f
                      ? "border-inset border-foreground bg-foreground text-background"
                      : "border-outset border-border-strong bg-card text-foreground"
                  }`}
                >
                  {f === "written" ? "Written" : "Recorded"}
                </button>
              ))}
            </div>
          )}
          {format === "written" ? (
            <Field>
              <FieldLabel htmlFor="feedback-body">your feedback</FieldLabel>
              <Textarea
                id="feedback-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="What worked, what didn't?"
              />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="feedback-url">recording link</FieldLabel>
              <Input
                id="feedback-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
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
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[10px] border border-border bg-card p-4 space-y-1.5"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{entry.authorAccountId}</span>
                <Badge variant="outline" className="text-[10px]">
                  {entry.format === "written" ? "Written" : "Recorded"}
                </Badge>
                <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
              </div>
              {entry.format === "written" ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{entry.body}</p>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
