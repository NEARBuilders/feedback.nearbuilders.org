import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Markdown, MarkdownEditor } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { invalidateRoundQueries } from "@/lib/queries/rounds";

export const README_PLACEHOLDER = "The round owner hasn't written a readme for testers yet.";
export const README_MAX_LENGTH = 20000;

interface RoundReadmeProps {
  roundId: string;
  readme: string;
  /** True for the owning org: shows the edit control and an "add one" prompt when empty. */
  canEdit: boolean;
}

/**
 * The round's readme for testers (what to test, how, what to focus on), rendered
 * prominently at the top of the round workspace. The owning org can edit it in place.
 */
export function RoundReadme({ roundId, readme, canEdit }: RoundReadmeProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(readme);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateRound({ id: roundId, readme: draft }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      setEditing(false);
      toast.success("Readme saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasReadme = readme.trim().length > 0;

  return (
    <Card className="p-5 space-y-4" data-testid="round-readme">
      <SectionHeader
        title="Readme"
        action={
          canEdit && !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(readme);
                setEditing(true);
              }}
            >
              {hasReadme ? "Edit readme" : "Add readme"}
            </Button>
          ) : undefined
        }
      />

      {editing ? (
        <div className="space-y-3">
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            maxLength={README_MAX_LENGTH}
            aria-label="Readme markdown"
            disabled={saveMutation.isPending}
          />
          <div className="flex gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save readme"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : hasReadme ? (
        <Markdown content={readme} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Add a readme so testers know what to test, how to do it, and what to focus on."
            : README_PLACEHOLDER}
        </p>
      )}
    </Card>
  );
}
