import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import { parseWinnersInput } from "@/lib/round-winners";

export function RoundWinnersForm({ roundId, winners }: { roundId: string; winners: string[] }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [text, setText] = useState(winners.join("\n"));
  const parsed = parseWinnersInput(text);
  const dirty = parsed.join("\n") !== winners.join("\n");

  const mutation = useMutation({
    mutationFn: () => apiClient.updateRoundSettings({ id: roundId, winners: parsed }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      toast.success(parsed.length > 0 ? "Winners saved" : "Winners cleared");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="space-y-3 p-4" data-testid="round-winners-form">
      <div>
        <span className="text-sm font-medium text-foreground">Winners</span>
        <span className="block text-xs text-muted-foreground">
          One account per line, best first. They show as a banner on the round page. Clear the list
          to remove it.
        </span>
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        disabled={mutation.isPending}
        placeholder={"alice.near\nbob.tg"}
        aria-label="Winners"
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
      />
      <Button size="sm" disabled={!dirty || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Saving…" : "Save winners"}
      </Button>
    </Card>
  );
}
