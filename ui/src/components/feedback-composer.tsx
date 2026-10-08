import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import {
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  MarkdownEditor,
  SegmentedToggle,
} from "@/components";
import { useClientValue } from "@/hooks";
import { invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { invalidateParticipationQueries } from "@/lib/queries/participation";
import { myFeedbackHref, roundParams } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { absoluteUrl, copyUrl, shareUrl } from "@/lib/share";

type FeedbackFormat = "written" | "recorded";

const FEEDBACK_BODY_MAX = 5000;

const FORMAT_HINTS: Record<FeedbackFormat, string> = {
  written:
    "Write up what you tried, what worked, and what didn't. Images can be pasted or dropped in. It's posted publicly on the round.",
  recorded: "Paste a link to your session recording — Loom, YouTube, anything viewable.",
};

type FeedbackDraft = { body: string; url: string };

const EMPTY_DRAFT: FeedbackDraft = { body: "", url: "" };

function writableFormats(formats: string[]): FeedbackFormat[] {
  return formats.filter((f): f is FeedbackFormat => f === "written" || f === "recorded");
}

interface FeedbackComposerProps {
  round: RoundDetail;
  accountId: string | null;
}

export function FeedbackComposer({ round, accountId }: FeedbackComposerProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const writable = writableFormats(round.formats);
  const [format, setFormat] = useState<FeedbackFormat>(writable[0] ?? "written");
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [posted, setPosted] = useState(false);
  const canShare = useClientValue(() => typeof navigator.share === "function", false);
  const draftKey = `feedback-draft:${accountId}:${round.id}`;

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

  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.postFeedback({
        id: round.id,
        format,
        body: format === "written" ? draft.body.trim() : undefined,
        url: format === "recorded" ? draft.url.trim() : undefined,
      }),
    onSuccess: () => {
      setPosted(true);
      setDraft(EMPTY_DRAFT);
      localStorage.removeItem(draftKey);
      void invalidateFeedbackQueries(queryClient, round.id);
      void invalidateParticipationQueries(queryClient);
      toast.success("Feedback posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (writable.length === 0) return null;

  const canSubmit =
    !postMutation.isPending &&
    pendingUploads === 0 &&
    (format === "written" ? draft.body.trim().length > 0 : draft.url.trim().length > 0);

  if (posted && accountId) {
    const url = absoluteUrl(myFeedbackHref(round, accountId));
    return (
      <Card className="p-6 space-y-4" data-testid="feedback-posted">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Feedback posted</p>
            <p className="text-sm text-muted-foreground">
              {round.isPrivate
                ? "This round is private: only the round organizers can read it. Share the link below to point them straight to your feedback."
                : "Your feedback is live on the round. Share the link to point people straight to it."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link
              to="/projects/$slug/$n/feedback"
              params={roundParams(round)}
              search={{ author: accountId }}
            >
              view your feedback
            </Link>
          </Button>
          {canShare && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void shareUrl({ title: `Feedback for ${round.title}`, url })}
            >
              <Share2 className="h-3.5 w-3.5" />
              share
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void copyUrl(url)}>
            <Link2 className="h-3.5 w-3.5" />
            copy link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setPosted(false)}>
            post another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      {writable.length > 1 && (
        <SegmentedToggle
          value={format}
          onValueChange={setFormat}
          options={writable.map((f) => ({
            value: f,
            label: f === "written" ? "Written" : "Recorded",
          }))}
          ariaLabel="Feedback format"
        />
      )}
      <p className="text-xs text-muted-foreground">{FORMAT_HINTS[format]}</p>
      {format === "written" ? (
        <Field>
          <FieldLabel htmlFor="feedback-body">your feedback</FieldLabel>
          <MarkdownEditor
            id="feedback-body"
            value={draft.body}
            onChange={(body) => setDraft((prev) => ({ ...prev, body }))}
            maxLength={FEEDBACK_BODY_MAX}
            aria-label="Feedback"
            disabled={postMutation.isPending}
            onPendingUploadsChange={setPendingUploads}
          />
          <span className="text-right text-xs text-muted-foreground">
            {draft.body.length}/{FEEDBACK_BODY_MAX}
            {pendingUploads > 0
              ? ` · uploading ${pendingUploads} image${pendingUploads > 1 ? "s" : ""}...`
              : " · draft saved on this device"}
          </span>
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
        {postMutation.isPending ? "posting..." : "post feedback"}
      </Button>
    </Card>
  );
}
