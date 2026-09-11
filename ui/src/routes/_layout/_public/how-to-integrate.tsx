import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Card } from "@/components";
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
    body: "Sign in with your NEAR wallet and submit a round for a project you own — what needs testing, the feedback formats you'll accept (written notes, a recorded session, or GitHub issues), and an optional repo link. It goes live immediately, no approval step.",
  },
  {
    n: 2,
    title: "Builders join",
    body: "Any signed-in builder can join an open round from the feed. Joining is open — first come, no application queue — and a builder can leave again any time before the round closes.",
  },
  {
    n: 3,
    title: "Collect feedback",
    body: "Joined builders try the product and post feedback in one of the round's formats while it's open. Bugs are filed on your own GitHub — this service never mirrors or rebuilds an issue tracker.",
  },
  {
    n: 4,
    title: "Close and credit",
    body: "When you're done, close the round and mark which of the builders who posted feedback contributed meaningfully, with an optional summary. That credit is permanent and shows on each builder's NEAR Builders profile.",
  },
];

const FOR_OWNERS = [
  "Formats are yours to choose per round — pick any mix of written, recorded, or GitHub issues.",
  "Credit is a human judgment call. Nothing is scored or selected automatically.",
  "Closing a round is final — accepted feedback and credit are never edited afterward, only hidden by a platform admin if needed.",
];

const FOR_BUILDERS = [
  "You need a NEAR account linked to join a round or get credited — link one from Settings → Auth methods.",
  "You can post feedback more than once while a round is open; only builders who posted are eligible for credit when it closes.",
  "Credit you receive is portable — it shows on your public profile page, linked from the round.",
];

// TODO(phase 11): revisit once the API-key integration path for external projects ships.
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
            builders join and try it, testers report back, and the round produces a durable record
            of who contributed.
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

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">For project owners</h2>
            <ul className="space-y-2">
              {FOR_OWNERS.map((item) => (
                <li key={item} className="text-sm text-muted-foreground leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">For builders</h2>
            <ul className="space-y-2">
              {FOR_BUILDERS.map((item) => (
                <li key={item} className="text-sm text-muted-foreground leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/feed">browse open rounds</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/feed/request">request a round</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
