import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";

export const Route = createFileRoute("/_layout/")({
  head: () => ({
    meta: [
      { title: "Feedback Rounds" },
      {
        name: "description",
        content: "Propose a feedback round for your project, join one, and share feedback.",
      },
    ],
  }),
  component: FeedbackRoundsLanding,
});

function FeedbackRoundsLanding() {
  return (
    <PageContainer variant="narrow">
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Feedback Rounds
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Propose a round for your project, let builders join, and collect written and recorded
            feedback in one place.
          </p>
        </div>
        {/* /feedback lands in #4 (browse open rounds) — plain anchor until that route exists */}
        <Button asChild>
          <a href="/feedback">browse rounds</a>
        </Button>
      </div>
    </PageContainer>
  );
}
