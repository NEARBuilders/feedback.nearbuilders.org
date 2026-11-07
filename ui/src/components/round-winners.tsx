import { Link, useRouterState } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { isCompact } from "@/lib/app-shell";

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

/** Scrolls only when the list is wider than its container; a short list stays put. */
function WinnerStrip({ winners }: { winners: readonly string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const list = listRef.current;
    if (!container || !list) return;
    const measure = () => setOverflowing(list.scrollWidth > container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [winners]);

  return (
    <div
      ref={containerRef}
      className={
        overflowing
          ? "min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_3%,black_97%,transparent)]"
          : "min-w-0 flex-1 overflow-hidden"
      }
    >
      <div
        className={
          overflowing
            ? "flex w-max animate-winners-marquee hover:[animation-play-state:paused] motion-reduce:animate-none"
            : "flex w-max"
        }
      >
        <div ref={listRef}>
          <WinnerList winners={winners} />
        </div>
        {overflowing && <WinnerList winners={winners} hidden />}
      </div>
    </div>
  );
}

export function RoundWinnersBanner({ winners }: { winners: readonly string[] }) {
  const compact = useRouterState({ select: (s) => isCompact(s.location.search) });
  if (compact || winners.length === 0) return null;

  return (
    <div
      className="flex items-center gap-4 rounded-xl border border-border bg-muted px-4 py-2.5"
      data-testid="round-winners"
    >
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">
        <Trophy className="h-4 w-4" />
        Winners
      </div>
      <WinnerStrip winners={winners} />
    </div>
  );
}
