import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";

export const Route = createFileRoute("/_layout/_public/how-to-integrate")({
  head: () => ({
    meta: [
      { title: "How it works | Feedback Rounds" },
      {
        name: "description",
        content: "How to request and run a feedback round for your project.",
      },
    ],
  }),
  component: HowToIntegratePage,
});

const STEPS = [
  {
    n: 1,
    title: "Request a round",
    body: "Sign in with your NEAR wallet and submit a round for a project you own — what you want tested, the feedback formats you'll accept, and the testing window.",
  },
  {
    n: 2,
    title: "Pick your testers",
    body: "Builders apply to test. Applying is an expression of interest — you choose who takes part, up to the number of slots you set.",
  },
  {
    n: 3,
    title: "Collect feedback",
    body: "Selected testers use the product and submit written notes or a recorded session during the window. Bugs are filed on your own GitHub — this service never rebuilds an issue tracker.",
  },
  {
    n: 4,
    title: "Close and credit",
    body: "When the window ends you close the round and mark who contributed meaningfully. That credit appears on each builder's NEAR Builders profile.",
  },
];

// TODO(phase 8): expand with API details and screenshots once the round flow is wired.
function HowToIntegratePage() {
  return (
    <PageContainer variant="default">
      <div className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            How it works
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
            Feedback Rounds is matchmaking plus a paper trail: a project posts what it needs tested,
            builders apply, the project selects testers, testers report back, and the round produces
            a durable record of who contributed.
          </p>
        </header>

        <ol className="space-y-6">
          {STEPS.map(({ n, title, body }) => (
            <li key={n} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-sm font-bold text-background">
                {n}
              </span>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/feed">browse open rounds</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">sign in to request a round</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
