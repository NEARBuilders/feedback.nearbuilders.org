import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Input, Skeleton } from "@/components";
import { invalidateParticipationQueries } from "@/lib/queries/participation";
import { creditCandidatesQueryOptions, invalidateRoundQueries } from "@/lib/queries/rounds";

export function CloseRoundPanel({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, { meaningful: boolean; summary: string }>>({});

  const candidatesQuery = useQuery({
    ...creditCandidatesQueryOptions(apiClient, roundId),
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
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      void invalidateParticipationQueries(queryClient);
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
