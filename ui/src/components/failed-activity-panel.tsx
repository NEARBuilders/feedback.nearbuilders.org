import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { describeFailure, describeOutboxEvent, summariseFailed } from "@/lib/failed-activity";
import { failedActivityKeys, failedActivityQueryOptions } from "@/lib/queries/failed-activity";

export function FailedActivityPanel() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const failed = useQuery(failedActivityQueryOptions(apiClient));

  const retry = useMutation({
    mutationFn: (ids: string[]) => apiClient.retryFailedActivityEvents({ ids }),
    onSuccess: ({ retried }) => {
      void queryClient.invalidateQueries({ queryKey: failedActivityKeys.all });
      toast.success(`Queued ${retried} event${retried === 1 ? "" : "s"} to send again`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (failed.isPending) {
    return <p className="text-sm text-muted-foreground">Loading activity events...</p>;
  }

  if (failed.isError) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-destructive">Couldn't load failed activity events.</p>
        <Button size="sm" variant="outline" onClick={() => void failed.refetch()}>
          try again
        </Button>
      </Card>
    );
  }

  const rows = failed.data;
  if (rows.length === 0) {
    return (
      <Card className="p-4" data-testid="failed-activity-empty">
        <p className="text-sm text-muted-foreground">
          Nothing is stuck. Every activity event has been delivered or is still retrying.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4" data-testid="failed-activity">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {rows.length} event{rows.length === 1 ? "" : "s"} could not be delivered
          </p>
          <p className="text-xs text-muted-foreground">
            {summariseFailed(rows)
              .map((item) => `${item.count} ${item.kind}`)
              .join(", ")}
          </p>
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
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start gap-3 py-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{describeOutboxEvent(row)}</p>
              <p className="break-words text-xs text-muted-foreground">
                {row.actor ? `${row.actor}. ` : ""}
                {describeFailure(row)}
              </p>
            </div>
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
