import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useApiClient } from "@/app";
import { isCompact } from "@/lib/app-shell";
import { roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { parseRoundOverviewPath } from "@/lib/round-winners";

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
  const apiClient = useApiClient();
  const target = useRouterState({
    select: (s) =>
      isCompact(s.location.search) ? null : parseRoundOverviewPath(s.location.pathname),
  });
  const { data: round } = useQuery({
    ...roundBySlugQueryOptions(apiClient, target?.slug ?? "", target?.number ?? 0),
    enabled: target !== null,
  });
  const winners = target ? (round?.winners ?? []) : [];
  if (winners.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-4 border-b border-border bg-muted px-4 py-2.5 sm:px-6"
      data-testid="round-winners"
    >
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">
        <Trophy className="h-4 w-4" />
        Winners
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
