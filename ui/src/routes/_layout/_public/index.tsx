import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
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

// TODO(phase 4): full landing — what Feedback Rounds is, 3-step "how it works",
// CTAs to the feed and to requesting a round.
function LandingPage() {
  return (
    <PageContainer variant="narrow">
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Feedback Rounds
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Project owners request a testing round, builders sign up to test and leave feedback, and
            contributors get credit on their NEAR Builders profile.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/about">learn more</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">sign in</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
