import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components";
import { LandingHeading, LandingHighlight } from "@/components/landing/landing-heading";
import { LandingTopTesters } from "@/components/landing/landing-top-testers";
import { RoundJoinCta } from "@/components/round-join-cta";
import { RoundListTitle } from "@/components/round-list-title";
import { roundParams } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";
import { useRoundCtas } from "@/lib/use-round-cta";

export interface LiveRound {
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
  rounds: Array<LiveRound & Partial<RoundDetail>>;
  isLoading: boolean;
  isError: boolean;
}) {
  const { ctaFor } = useRoundCtas();
  return (
    <section className="space-y-6" aria-labelledby="live-rounds">
      <div className="flex items-end justify-between gap-4">
        <LandingHeading id="live-rounds" eyebrow="Open now">
          Rounds you can <LandingHighlight>join today</LandingHighlight>
        </LandingHeading>
        <Button asChild variant="ghost" size="sm">
          <Link to="/rounds">
            all rounds <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-split-2-1">
        <div>
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
              No rounds are open right now. Check back soon, or request a round for your own
              project.
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border bg-card">
              {rounds.map((round) => (
                <li key={round.id} className="flex items-center gap-3 pr-4 hover:bg-accent">
                  <Link
                    to="/projects/$slug/$n"
                    params={roundParams(round)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4"
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
                  <LandingRoundAction round={round} ctaFor={ctaFor} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <LandingTopTesters />
      </div>
    </section>
  );
}

/**
 * Join, leave or sign in without opening the round first (#301). A Legion-gated round needs
 * the full check that only the round page runs, so it sends the visitor there instead.
 */
function LandingRoundAction({
  round,
  ctaFor,
}: {
  round: LiveRound & Partial<RoundDetail>;
  ctaFor: (round: RoundDetail) => ReturnType<ReturnType<typeof useRoundCtas>["ctaFor"]>;
}) {
  if (!round.ownerAccountId) return null; // list rows without full round detail
  const cta = ctaFor(round as RoundDetail);
  if (cta.kind === "none") return null;
  if (cta.kind === "leave") {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/projects/$slug/$n/submit" params={roundParams(round)}>
          write feedback
        </Link>
      </Button>
    );
  }
  if (cta.kind === "join" && round.legionOnly) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/projects/$slug/$n" params={roundParams(round)}>
          view to join
        </Link>
      </Button>
    );
  }
  return <RoundJoinCta round={round} cta={cta} size="sm" />;
}
