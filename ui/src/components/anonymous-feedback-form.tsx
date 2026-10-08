import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Field, FieldLabel, Input, SegmentedToggle, Textarea } from "@/components";
import { invalidateFeedbackQueries } from "@/lib/queries/feedback";

type Format = "written" | "recorded";

const BODY_MAX = 5000;

interface AnonymousFeedbackFormProps {
  roundId: string;
  formats: string[];
}

/**
 * Post feedback with no identity attached, on rounds that opted in (#89). It works without
 * signing in or joining, and nothing about the poster is stored.
 */
export function AnonymousFeedbackForm({ roundId, formats }: AnonymousFeedbackFormProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const writable = formats.filter((f): f is Format => f === "written" || f === "recorded");
  const [format, setFormat] = useState<Format>(writable[0] ?? "written");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

  const postMutation = useMutation({
    mutationFn: () =>
      apiClient.postFeedback({
        id: roundId,
        format,
        anonymous: true,
        body: format === "written" ? body.trim() : undefined,
        url: format === "recorded" ? url.trim() : undefined,
      }),
    onSuccess: () => {
      setBody("");
      setUrl("");
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.success("Anonymous feedback posted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (writable.length === 0) return null;

  const canSubmit =
    !postMutation.isPending &&
    (format === "written" ? body.trim().length > 0 : url.trim().length > 0);

  return (
    <Card className="space-y-4 p-5" data-testid="anonymous-feedback-form">
      <div className="space-y-1">
        <span className="text-sm font-medium text-foreground">Post anonymously</span>
        <p className="text-xs text-muted-foreground">
          No sign-in needed and no identity is stored. Anonymous posts earn no points or credit.
        </p>
      </div>
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
      {format === "written" ? (
        <Field>
          <FieldLabel htmlFor="anonymous-body">your feedback</FieldLabel>
          <Textarea
            id="anonymous-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={BODY_MAX}
            placeholder="What worked, what didn't?"
          />
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="anonymous-url">recording link</FieldLabel>
          <Input
            id="anonymous-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </Field>
      )}
      <Button onClick={() => postMutation.mutate()} disabled={!canSubmit}>
        {postMutation.isPending ? "posting..." : "post anonymously"}
      </Button>
    </Card>
  );
}
