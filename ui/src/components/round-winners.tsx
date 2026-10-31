import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { isCompact } from "@/lib/app-shell";
import { getWinnersForPath } from "@/lib/round-winners";

function WinnerList({ winners, hidden }: { winners: readonly string[]; hidden?: boolean }) {
  return (
    <ol
      className="flex shrink-0 items-center gap-x-8 pr-8 text-sm"
      aria-hidden={hidden || undefined}
      data-testid={hidden ? undefined : "round-winners-list"}
    >
      {winners.map((accountId, index) => (
        <li key={accountId} className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
          <Link
            to="/$accountId"
            params={{ accountId }}
            tabIndex={hidden ? -1 : undefined}
            className="font-mono text-foreground hover:underline"
          >
            {accountId}
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function RoundWinnersBanner() {
  const winners = useRouterState({
    select: (s) => (isCompact(s.location.search) ? [] : getWinnersForPath(s.location.pathname)),
  });
  if (winners.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-4 border-b border-border bg-muted px-4 py-2.5 sm:px-6"
      data-testid="round-winners"
    >
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">
        <Trophy className="h-4 w-4" />
        Top {winners.length} testers · reward winners
      </div>
      <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]">
        <div className="flex w-max animate-winners-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          <WinnerList winners={winners} />
          <WinnerList winners={winners} hidden />
        </div>
      </div>
    </div>
  );
}
