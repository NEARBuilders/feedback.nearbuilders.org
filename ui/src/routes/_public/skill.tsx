import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getAccount, getActiveRuntime, getAppName } from "@/app";
import { Button, EmptyState, Markdown, PageHeader } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { pageHead } from "@/lib/page-title";

const INTENT_REGISTRY_URL = "https://tanstack.com/intent/registry/everything-dev";

export const Route = createFileRoute("/_public/skill")({
  loader: async ({ context }) => {
    const runtimeConfig = context.runtimeConfig;

    const skill = await fetch("/skill.md")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load skill: ${response.status}`);
        }

        return response.text();
      })
      .catch(() => null);

    return {
      runtimeConfig,
      skill,
      intentRegistryUrl: INTENT_REGISTRY_URL,
    };
  },
  head: () =>
    pageHead(
      "Skill",
      "Agent-oriented instructions for running, editing, and publishing this runtime.",
    ),
  component: SkillPage,
});

function SkillPage() {
  const { skill, runtimeConfig, intentRegistryUrl } = Route.useLoaderData();
  const runtime = getActiveRuntime(runtimeConfig);
  const account = getAccount(runtimeConfig);
  const appName = getAppName(runtimeConfig);
  const [copied, setCopied] = useState(false);

  const accountId = runtime?.accountId ?? account;

  const handleCopy = async () => {
    if (!skill) {
      toast.error("Skill prompt unavailable");
      return;
    }

    await navigator.clipboard.writeText(skill);
    setCopied(true);
    toast.success("Skill prompt copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          icon={FileText}
          label={accountId}
          title={appName}
          description="Agent-ready prompt for TanStack Intent, local development, UI changes, and publish flow."
          actions={
            <>
              <Button variant="outline" onClick={handleCopy} disabled={!skill}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy prompt"}
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="/skill.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="skill.raw-link"
                >
                  <ExternalLink size={14} />
                  raw skill.md
                </a>
              </Button>
              <Button asChild>
                <a href={intentRegistryUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={14} />
                  TanStack Intent
                </a>
              </Button>
            </>
          }
        />

        <div className="rounded-[12px] border border-border bg-card p-6 space-y-4">
          <div className="rounded-[8px] border border-border bg-muted px-3.5 py-3 text-sm text-muted-foreground">
            Best entry points: `npx @tanstack/intent@latest load everything-dev`, `/skill.md`, and
            the registry page above.
          </div>
        </div>

        {skill ? (
          <div className="rounded-[12px] border border-border bg-card p-8">
            <Markdown content={skill} />
          </div>
        ) : (
          <EmptyState icon={FileText} title="Skill prompt unavailable." className="min-h-[20vh]" />
        )}
      </div>
    </PageContainer>
  );
}
