import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { SectionHeader } from "@/components/layout/section-header";
import { FormatCheckboxes } from "@/components/round-fields";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import type { RoundDetail } from "@/lib/round-route";

export function RoundFormatsForm({ round }: { round: RoundDetail }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [formats, setFormats] = useState(round.formats);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.updateRound({ id: round.id, formats }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      toast.success("Formats saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unchanged = formats.join() === round.formats.join();

  return (
    <Card className="p-5 space-y-4" data-testid="round-formats">
      <SectionHeader title="Feedback formats" />
      <FormatCheckboxes
        value={formats}
        onChange={setFormats}
        disabled={saveMutation.isPending}
        issuesDisabled={!round.repoUrl}
      />
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={unchanged || formats.length === 0 || saveMutation.isPending}
      >
        {saveMutation.isPending ? "saving..." : "save formats"}
      </Button>
    </Card>
  );
}
