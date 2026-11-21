import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { Button, Card } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { pageHead } from "@/lib/page-title";

export const Route = createFileRoute("/_public/how-to-integrate")({
  head: () => pageHead("How it works", "How to request and run a feedback round for your project."),
  component: HowToIntegratePage,
});

const STEPS = [
  {
    n: 1,
    title: "Request a round",
    body: "Sign in with your NEAR wallet and submit a round for a project you own — what needs testing, the feedback formats you'll accept (written notes, a recorded session, or GitHub issues), and an optional repo link. A new project is reviewed by an admin once, and its first round opens when it is approved. After that, your organization's rounds open right away.",
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

const EMBED_EXAMPLE = `<script src="https://feedback.nearbuilders.org/embed.js" data-project="your-project-slug" defer></script>`;

const MCP_EXAMPLE = `POST https://feedback.nearbuilders.org/api/mcp
x-api-key: <your organization key>`;

const TOOLS = [
  {
    title: "Add a feedback button to your app",
    body: 'Paste one line into your app and testers get a button that opens your latest open round\'s send-feedback page, already knowing which page they were on. They still sign in and join here. Optional: data-label for the button text and data-position="left" to move it.',
    code: EMBED_EXAMPLE,
  },
  {
    title: "Review feedback with your own agent",
    body: "Open a round's agent tab to get its MCP address, the header to send and a ready prompt. Organization keys (org_) are read-only, so an agent can read a round and its feedback but never change it. Ask for an organization key from your organization's settings.",
    code: MCP_EXAMPLE,
  },
  {
    title: "Let your agent suggest, and decide yourself",
    body: 'An agent using an organization key can leave a suggested status or star on each item. Suggestions appear at the top of the inbox as "Suggested by your agent", and a member accepts or rejects each one. Nothing changes until a person accepts.',
  },
  {
    title: "Draft a report with your own assistant",
    body: "Testers can copy a prompt from the feedback box, paste it into their own AI assistant, answer its questions and paste the finished draft back. We never see that conversation and the tester reviews and posts the text.",
  },
];

function HowToIntegratePage() {
  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <PageHeader
          icon={CircleHelp}
          label="Feedback Rounds"
          title="How it works"
          description="Feedback Rounds is matchmaking plus a paper trail: a project posts what it needs tested, builders join and try it, testers report back, and the round produces a durable record of who contributed."
        />

        <ol className="space-y-6">
          {STEPS.map(({ n, title, body }) => (
            <li key={n} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-foreground text-sm font-bold text-background">
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

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Connect your tools</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {TOOLS.map(({ title, body, code }) => (
              <Card key={title} className="p-5 space-y-3">
                <h3 className="text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                {code ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 font-mono text-xs text-foreground">
                    {code}
                  </pre>
                ) : null}
              </Card>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Agents can also read{" "}
            <a href="/skill.md" className="underline">
              skill.md
            </a>{" "}
            for the full step-by-step instructions.
          </p>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/rounds">browse open rounds</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/manage/new">request a round</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
