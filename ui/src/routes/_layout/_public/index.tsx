import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, MessageSquare, UserCheck } from "lucide-react";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";

export const Route = createFileRoute("/_layout/_public/")({
  head: () => ({
    meta: [
      { title: "Feedback Rounds" },
      {
        name: "description",
        content:
          "Project owners request testing rounds, builders sign up to test and share feedback, and contributors get credit on their NEAR Builders profile.",
      },
    ],
  }),
  component: LandingPage,
});

const STEPS = [
  {
    icon: MessageSquare,
    title: "A project requests a round",
    body: "The owner describes what to test, picks the feedback formats they want, and opens the round for signups.",
  },
  {
    icon: UserCheck,
    title: "Builders sign up and test",
    body: "Builders join a round, try the product, and submit written notes or a recorded session during the window.",
  },
  {
    icon: ClipboardCheck,
    title: "The round closes with credit",
    body: "The owner marks who contributed meaningfully. That participation shows on each builder's NEAR Builders profile.",
  },
];

function LandingPage() {
  return (
    <PageContainer variant="default" className="pt-12 pb-16 sm:pt-20 sm:pb-24">
      <div className="space-y-16 sm:space-y-20">
        <section className="space-y-5">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Get your project tested by NEAR builders
          </h1>
          <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Feedback Rounds connects projects that need testing with builders who want to try things
            and report what's wrong. Every round produces a durable record of who contributed.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/feed">browse open rounds</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/how-to-integrate">how it works</Link>
            </Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            How a round works
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="border-2 border-outset border-border-strong bg-card p-5 rounded-[12px] shadow-sm space-y-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-foreground text-background">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Run a round on your project
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
            Sign in with your NEAR wallet to request a round. You choose the testers, the formats,
            and when it closes.
          </p>
          <Button asChild size="lg">
            <Link to="/feed/request">request a round</Link>
          </Button>
        </section>
      </div>
    </PageContainer>
  );
}
