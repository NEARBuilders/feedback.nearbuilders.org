import { Link } from "@tanstack/react-router";
import { Button } from "@/components";
import { DEFAULT_LEADERBOARD_PERIOD } from "@/lib/leaderboard";

export function LandingCta() {
  return (
    <section className="space-y-5 border border-border bg-card px-6 py-12 text-center sm:py-16">
      <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Ready to get real feedback?
      </h2>
      <p className="mx-auto max-w-xl text-sm text-muted-foreground sm:text-base">
        Sign in with your NEAR wallet to request a round, or join one as a tester.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/manage/new">request a round</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/rounds">browse open rounds</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        <Link to="/about" className="underline-offset-4 hover:underline">
          About
        </Link>
        {" · "}
        <Link to="/how-to-integrate" className="underline-offset-4 hover:underline">
          How it works
        </Link>
        {" · "}
        <Link to="/skill" className="underline-offset-4 hover:underline">
          For agents
        </Link>
        {" · "}
        <Link
          to="/leaderboard"
          search={{ period: DEFAULT_LEADERBOARD_PERIOD }}
          className="underline-offset-4 hover:underline"
        >
          Leaderboard
        </Link>
      </p>
    </section>
  );
}
