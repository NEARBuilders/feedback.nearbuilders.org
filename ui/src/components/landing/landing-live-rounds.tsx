import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components";
import { RoundListTitle } from "@/components/round-list-title";
import { roundParams } from "@/lib/round-links";

interface LiveRound {
  id: string;
  title: string;
  projectSlug: string;
  projectRoundNumber: number;
  formats: string[];
  participantCount: number;
  identity: { title: string } | null;
}

export function LandingLiveRounds({
  rounds,
  isLoading,
  isError,
}: {
  rounds: LiveRound[];
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section className="space-y-4" aria-labelledby="live-rounds">
      <div className="flex items-end justify-between gap-4">
        <h2
          id="live-rounds"
          className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
        >
          Open now
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/rounds">
            all rounds <ArrowRight />
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-px border border-border bg-border" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse bg-card" />
          ))}
        </div>
      ) : isError ? (
        <p className="border border-border bg-card p-4 text-sm text-muted-foreground">
          Could not load open rounds right now.
        </p>
      ) : rounds.length === 0 ? (
        <p className="border border-border bg-card p-4 text-sm text-muted-foreground">
          No rounds are open right now. Check back soon, or request a round for your own project.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card">
          {rounds.map((round) => (
            <li key={round.id}>
              <Link
                to="/projects/$slug/$n"
                params={roundParams(round)}
                className="flex items-center justify-between gap-4 p-4 hover:bg-accent"
              >
                <span className="min-w-0 space-y-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    <RoundListTitle
                      title={round.title}
                      projectRoundNumber={round.projectRoundNumber}
                    />
                  </span>
                  <span className="block truncate font-mono text-3xs text-muted-foreground">
                    {round.identity?.title ?? round.projectSlug} · {round.formats.join(", ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {round.participantCount} {round.participantCount === 1 ? "tester" : "testers"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
