import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components";
import { LandingHighlight } from "@/components/landing/landing-heading";
import type { LiveRound } from "@/components/landing/landing-live-rounds";
import { RoundListTitle } from "@/components/round-list-title";
import { roundParams } from "@/lib/round-links";

const EXAMPLE_ROUNDS = [
  { project: "your-project", title: "Try the new onboarding flow", meta: "written · 8 testers" },
  { project: "another-app", title: "Break the checkout", meta: "recorded · 5 testers" },
  { project: "a-third-tool", title: "First-run experience", meta: "issues · 12 testers" },
];

const POINTS = ["Private by default", "Credit on your NEAR Builders profile"];
const STACK_SIZE = 3;

function testerLabel(count: number) {
  return `${count} ${count === 1 ? "tester" : "testers"}`;
}

function RoundStack({ rounds }: { rounds: LiveRound[] }) {
  const live = rounds.slice(0, STACK_SIZE);

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none">
      <p className="mb-3 flex items-center gap-2 text-3xs font-medium uppercase tracking-6 text-muted-foreground">
        <span aria-hidden="true" className="size-1.5 bg-brand-accent" />
        {live.length > 0 ? "Open now" : "Example rounds"}
      </p>
      {live.length > 0 ? (
        <ul className="space-y-2">
          {live.map((round, index) => (
            <li key={round.id} style={{ marginLeft: `${index * 1.5}rem` }}>
              <Link
                to="/projects/$slug/$n"
                params={roundParams(round)}
                className="block space-y-1 border border-border bg-card p-4 hover:bg-accent"
              >
                <span className="block truncate font-mono text-3xs text-muted-foreground">
                  {round.identity?.title ?? round.projectSlug}
                </span>
                <span className="block truncate text-sm font-semibold text-foreground">
                  <RoundListTitle
                    title={round.title}
                    projectRoundNumber={round.projectRoundNumber}
                  />
                </span>
                <span className="block text-xs text-muted-foreground">
                  {round.formats.join(", ")} · {testerLabel(round.participantCount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2" aria-hidden="true">
          {EXAMPLE_ROUNDS.map((round, index) => (
            <li
              key={round.title}
              className="space-y-1 border border-border bg-card p-4"
              style={{ marginLeft: `${index * 1.5}rem` }}
            >
              <p className="font-mono text-3xs text-muted-foreground">{round.project}</p>
              <p className="text-sm font-semibold text-foreground">{round.title}</p>
              <p className="text-xs text-muted-foreground">{round.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LandingHero({ rounds }: { rounds: LiveRound[] }) {
  return (
    <section className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
      <div className="min-w-0 space-y-6">
        <p className="inline-flex items-center gap-2 border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <span aria-hidden="true" className="size-1.5 bg-brand-accent" />
          Open feedback rounds for the NEAR ecosystem
        </p>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Get your project tested by <LandingHighlight>NEAR builders</LandingHighlight>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Post a round, builders try your product and report what is wrong, and every round leaves
            a durable record of who contributed.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="w-full bg-brand-accent text-brand-on-accent hover:bg-brand-accent/90 sm:w-auto"
          >
            <Link to="/rounds">
              browse open rounds <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/how-to-integrate">how it works</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check className="size-4 text-brand-accent-strong" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <RoundStack rounds={rounds} />
    </section>
  );
}
