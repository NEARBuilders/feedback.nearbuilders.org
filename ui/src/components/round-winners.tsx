import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Card } from "@/components";

export function RoundWinners({ winners }: { winners: readonly string[] }) {
  if (winners.length === 0) return null;

  return (
    <Card className="space-y-4 p-4 sm:p-5" data-testid="round-winners">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Trophy className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            Top {winners.length} testers · reward winners
          </h2>
          <p className="text-sm text-muted-foreground">
            Ranked by contribution to this campaign. These testers will receive a reward.
          </p>
        </div>
      </div>

      <ol
        className="grid gap-x-8 gap-y-1.5 sm:grid-flow-col sm:[grid-template-rows:repeat(5,minmax(0,1fr))]"
        data-testid="round-winners-list"
      >
        {winners.map((accountId, index) => (
          <li key={accountId} className="flex min-w-0 items-center gap-3 text-sm">
            <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {index + 1}
            </span>
            <Link
              to="/$accountId"
              params={{ accountId }}
              className="min-w-0 truncate font-mono text-foreground hover:underline"
            >
              {accountId}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
