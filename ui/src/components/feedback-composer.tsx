import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import {
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  Markdown,
  SegmentedToggle,
  Textarea,
} from "@/components";
import { invalidateFeedbackQueries } from "@/lib/queries/feedback";
import { invalidateParticipationQueries } from "@/lib/queries/participation";

type FeedbackFormat = "written" | "recorded";

const FEEDBACK_BODY_MAX = 5000;

const FORMAT_HINTS: Record<FeedbackFormat, string> = {
  written:
    "Write up what you tried, what worked, and what didn't. It's posted publicly on the round.",
  recorded: "Paste a link to your session recording — Loom, YouTube, anything viewable.",
};

type FeedbackDraft = { body: string; url: string };

const EMPTY_DRAFT: FeedbackDraft = { body: "", url: "" };

function writableFormats(formats: string[]): FeedbackFormat[] {
  return formats.filter((f): f is FeedbackFormat => f === "written" || f === "recorded");
}

interface FeedbackComposerProps {
  roundId: string;
  formats: string[];
  accountId: string | null;
}

export function FeedbackComposer({ roundId, formats, accountId }: FeedbackComposerProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const writable = writableFormats(formats);
  const [format, setFormat] = useState<FeedbackFormat>(writable[0] ?? "written");
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const draftKey = `feedback-draft:${accountId}:${roundId}`;

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
        id: roundId,
        format,
        body: format === "written" ? draft.body.trim() : undefined,
        url: format === "recorded" ? draft.url.trim() : undefined,
      }),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      setMode("write");
      localStorage.removeItem(draftKey);
      void invalidateFeedbackQueries(queryClient, roundId);
      void invalidateParticipationQueries(queryClient);
      toast.success("Feedback posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (writable.length === 0) return null;

  const canSubmit =
    !postMutation.isPending &&
    (format === "written" ? draft.body.trim().length > 0 : draft.url.trim().length > 0);

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
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="feedback-body">your feedback</FieldLabel>
            <SegmentedToggle
              value={mode}
              onValueChange={setMode}
              options={[
                { value: "write", label: "Write" },
                { value: "preview", label: "Preview" },
              ]}
              ariaLabel="Composer mode"
            />
          </div>
          {mode === "write" ? (
            <Textarea
              id="feedback-body"
              value={draft.body}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              rows={8}
              maxLength={FEEDBACK_BODY_MAX}
              placeholder="What worked, what didn't? Markdown works."
            />
          ) : (
            <div className="min-h-40 rounded-md border border-border p-4">
              {draft.body.trim() ? (
                <Markdown content={draft.body} />
              ) : (
                <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
              )}
            </div>
          )}
          <span className="text-right text-xs text-muted-foreground">
            {draft.body.length}/{FEEDBACK_BODY_MAX} · draft saved on this device
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
