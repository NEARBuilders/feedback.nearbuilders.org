import { Button } from "@/components";

export function QueryError({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3" role="alert">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Retry"}
      </Button>
    </div>
  );
}
