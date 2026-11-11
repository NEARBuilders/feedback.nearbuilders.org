import { Link } from "@tanstack/react-router";
import { Button } from "@/components";

const EXAMPLE_ROUNDS = [
  { project: "your-project", title: "Try the new onboarding flow", meta: "written · 8 testers" },
  { project: "another-app", title: "Break the checkout", meta: "recorded · 5 testers" },
  { project: "a-third-tool", title: "First-run experience", meta: "issues · 12 testers" },
];

export function LandingHero() {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <div className="space-y-5">
        <p className="text-xs font-medium uppercase tracking-6 text-muted-foreground">
          NEAR Builders · Feedback Rounds
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Get your project tested by NEAR builders
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Post a round, builders try your product and report what is wrong, and every round leaves a
          durable record of who contributed.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/rounds">browse open rounds</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/how-to-integrate">how it works</Link>
          </Button>
        </div>
      </div>
      <div className="space-y-2" aria-hidden="true">
        <p className="text-3xs font-medium uppercase tracking-6 text-muted-foreground">
          Example rounds
        </p>
        {EXAMPLE_ROUNDS.map((round, index) => (
          <div
            key={round.title}
            className="space-y-1 border border-border bg-card p-4"
            style={{ marginLeft: `${index * 1.5}rem` }}
          >
            <p className="font-mono text-3xs text-muted-foreground">{round.project}</p>
            <p className="text-sm font-semibold text-foreground">{round.title}</p>
            <p className="text-xs text-muted-foreground">{round.meta}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
