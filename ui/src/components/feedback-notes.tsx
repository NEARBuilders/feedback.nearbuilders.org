import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import { Badge, Button, Textarea } from "@/components";
import { invalidateFeedbackQueries } from "@/lib/queries/feedback";

export type FeedbackNote = Awaited<ReturnType<ApiClient["addFeedbackNote"]>>;

const NOTE_MAX = 1000;

export function FeedbackNoteThread({ notes }: { notes: FeedbackNote[] }) {
  if (notes.length === 0) return null;
  return (
    <ol className="space-y-2 border-l-2 border-border pl-3" data-testid="feedback-notes">
      {notes.map((note) => (
        <li key={note.id} className="space-y-0.5">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={note.role === "owner" ? "secondary" : "outline"}>{note.role}</Badge>
            <span className="font-mono">{note.authorAccountId}</span>
            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{note.body}</p>
        </li>
      ))}
    </ol>
  );
}

interface FeedbackNoteFormProps {
  roundId: string;
  feedbackId: string;
  placeholder: string;
  submitLabel: string;
  extraActions?: (note: string, clear: () => void) => ReactNode;
}

export function FeedbackNoteForm({
  roundId,
  feedbackId,
  placeholder,
  submitLabel,
  extraActions,
}: FeedbackNoteFormProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const clear = () => setNote("");

  const addMutation = useMutation({
    mutationFn: () => apiClient.addFeedbackNote({ id: roundId, feedbackId, body: note }),
    onSuccess: () => {
      clear();
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.success("Note sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-2">
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={NOTE_MAX}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <div className="flex flex-wrap items-center gap-2">
        {extraActions?.(note.trim(), clear)}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => addMutation.mutate()}
          disabled={!note.trim() || addMutation.isPending}
        >
          <Send className="h-3.5 w-3.5" />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
