import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { describeOutboxEvent } from "@/lib/failed-activity";
import {
  roundFailedActivityKeys,
  roundFailedActivityQueryOptions,
} from "@/lib/queries/failed-activity";

/**
 * Credit and round events that never reached the activity gateway. Shown to the round's
 * owner only when something is stuck, so builders don't silently miss the points they earned.
 */
export function RoundDeliveryPanel({ roundId }: { roundId: string }) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const failed = useQuery(roundFailedActivityQueryOptions(apiClient, roundId));

  const retry = useMutation({
    mutationFn: (ids: string[]) => apiClient.retryRoundFailedActivity({ id: roundId, ids }),
    onSuccess: ({ retried }) => {
      void queryClient.invalidateQueries({ queryKey: roundFailedActivityKeys.round(roundId) });
      toast.success(`Queued ${retried} event${retried === 1 ? "" : "s"} to send again`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = failed.data ?? [];
  if (rows.length === 0) return null;

  return (
    <Card className="space-y-3 border-destructive p-4" data-testid="round-delivery-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-destructive" />
          <span className="text-sm font-medium text-foreground">
            {rows.length} activity event{rows.length === 1 ? "" : "s"} could not be delivered
          </span>
        </div>
        <Button
          size="sm"
          disabled={retry.isPending}
          onClick={() => retry.mutate(rows.map((row) => row.id))}
        >
          <RotateCw className="h-3.5 w-3.5" />
          retry all
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        These did not reach the activity gateway, so the points may be missing from builders'
        profiles. Retry once and an admin can look if it keeps failing.
      </p>
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-foreground">
              {describeOutboxEvent(row)}
              {row.actor ? <span className="text-muted-foreground"> · {row.actor}</span> : null}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={retry.isPending}
              onClick={() => retry.mutate([row.id])}
            >
              retry
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
