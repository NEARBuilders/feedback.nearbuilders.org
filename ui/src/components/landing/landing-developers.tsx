import { Copy } from "lucide-react";
import { useState } from "react";
import { Button, Tabs, TabsList, TabsTrigger } from "@/components";
import { LandingHeading, LandingHighlight } from "@/components/landing/landing-heading";
import { CODE_SAMPLES } from "@/lib/landing-snippets";
import { copyText } from "@/lib/share";

const STEPS = [
  {
    title: "Request a round",
    body: "Sign in with your NEAR wallet and describe what you want tested. Rounds are private by default.",
  },
  {
    title: "Add the button",
    body: "Paste one script tag into your app so testers can send feedback from where they use it.",
  },
  {
    title: "Review with an agent",
    body: "Mint a read-only organization key and connect an agent over MCP or REST to triage what comes back.",
  },
];

function CodePanel() {
  const [active, setActive] = useState<string>(CODE_SAMPLES[0].value);
  const sample = CODE_SAMPLES.find((item) => item.value === active) ?? CODE_SAMPLES[0];

  return (
    <div className="min-w-0 border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
        <Tabs value={active} onValueChange={setActive} className="min-w-0 overflow-x-auto">
          <TabsList>
            {CODE_SAMPLES.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void copyText(sample.code, "Snippet copied")}
        >
          <Copy className="size-3.5" />
          copy
        </Button>
      </div>
      <pre className="overflow-x-auto bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground">
        {sample.code}
      </pre>
    </div>
  );
}

export function LandingDevelopers() {
  return (
    <section className="space-y-8" aria-labelledby="for-projects-apps">
      <LandingHeading
        id="for-projects-apps"
        eyebrow="For projects and apps"
        description="One round, one snippet, one key. Add the button to your app and let an agent triage what comes back."
      >
        Set up in <LandingHighlight>three steps</LandingHighlight>
      </LandingHeading>
      <div className="grid gap-8 lg:grid-cols-split-2-3 lg:items-start">
        <ol className="space-y-6">
          {STEPS.map(({ title, body }, index) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center bg-brand-accent text-sm font-semibold text-brand-on-accent">
                {index + 1}
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <CodePanel />
      </div>
    </section>
  );
}
