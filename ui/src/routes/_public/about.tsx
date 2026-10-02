import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, FileText, Sparkles } from "lucide-react";
import { getAccount, getActiveRuntime, getAppName, getRepository } from "@/app";
import { EmptyState, Markdown, PageContainer, PageHeader } from "@/components";
import { pageHead } from "@/lib/page-title";

function sanitizeMarkdownContent(content: string): string {
  return content
    .replace(/<!-- markdownlint-disable[^>]*-->/g, "")
    .replace(/<div align="center">[\s\S]*?<\/div>/g, "")
    .trim();
}

function getRawReadmeUrls(repositoryUrl: string): string[] {
  try {
    const url = new URL(repositoryUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return [];
    }
    const [owner, repo] = parts;
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
      `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
    ];
  } catch {
    return [];
  }
}

async function fetchRepositoryReadme(repositoryUrl: string): Promise<string | null> {
  const candidates = getRawReadmeUrls(repositoryUrl);
  if (candidates.length === 0) return null;
  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return sanitizeMarkdownContent(await response.text());
    } catch {}
  }
  return null;
}

export const Route = createFileRoute("/_public/about")({
  loader: async ({ context }) => {
    const repository = getRepository(context.runtimeConfig);
    const description =
      ((context.runtimeConfig as Record<string, unknown>)?.description as string | null) ?? null;
    let readme: string | null = null;
    if (repository) {
      readme = await fetchRepositoryReadme(repository).catch(() => null);
    }
    return { repository, readme, description, runtimeConfig: context.runtimeConfig };
  },
  head: () => pageHead("About", "About this runtime-composed app on NEAR."),
  component: About,
});

function isGithubUrl(url: string) {
  return /github\.com/i.test(url);
}

function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.165c-3.338.726-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.52 11.52 0 0 1 12 6.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.218.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

function About() {
  const { repository, readme, description, runtimeConfig } = Route.useLoaderData();
  const runtime = getActiveRuntime(runtimeConfig);
  const account = getAccount(runtimeConfig);
  const appName = getAppName(runtimeConfig);

  const accountId = runtime?.accountId ?? account;
  const githubRepo = repository && isGithubUrl(repository) ? parseGithubRepo(repository) : null;

  return (
    <PageContainer variant="default">
      <div className="space-y-4">
        <PageHeader
          icon={BookOpen}
          label={accountId}
          title={appName}
          subtitle={githubRepo ? `${githubRepo.owner}/${githubRepo.repo}` : undefined}
          actions={
            <>
              <Link
                to="/skill"
                preload="intent"
                className="h-9 rounded-[12px] px-4 text-sm font-bold inline-flex items-center gap-2 no-underline transition-colors duration-150 bg-foreground text-background hover:opacity-90"
              >
                <Sparkles size={14} />
                Skill
              </Link>
              <a
                href="/skill.md"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 rounded-[12px] px-4 text-sm font-bold inline-flex items-center gap-2 no-underline transition-colors duration-150 bg-secondary text-foreground hover:bg-border"
              >
                <FileText size={14} />
                skill.md
              </a>
              {repository && (
                <a
                  href={repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 rounded-[12px] px-4 text-sm font-bold inline-flex items-center gap-2 no-underline transition-colors duration-150 bg-secondary text-foreground hover:bg-border"
                >
                  {isGithubUrl(repository) ? <GithubIcon size={14} /> : <ExternalLink size={14} />}
                  {isGithubUrl(repository) ? "GitHub" : "Repository"}
                </a>
              )}
            </>
          }
        />

        <div className="rounded-[12px] border border-border bg-card p-6 space-y-4">
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}

          {repository && (
            <div className="rounded-[8px] border border-border bg-muted px-3.5 py-2.5 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 min-w-[64px]">
                repo
              </span>
              <a
                href={repository}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-foreground hover:underline truncate"
              >
                {repository}
              </a>
            </div>
          )}

          <div className="rounded-[8px] border border-border bg-muted px-3.5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                for agents and builders
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Open the skill page for the essential TanStack Intent, local dev, and publish
                instructions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/skill"
                preload="intent"
                className="h-9 rounded-[12px] px-4 text-sm font-bold inline-flex items-center gap-2 no-underline transition-colors duration-150 bg-card text-foreground border border-border hover:bg-background"
                data-testid="about.open-skill-link"
              >
                <Sparkles size={14} />
                Open skill
              </Link>
              <a
                href="/skill.md"
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 rounded-[12px] px-4 text-sm font-bold inline-flex items-center gap-2 no-underline transition-colors duration-150 bg-card text-foreground border border-border hover:bg-background"
              >
                <FileText size={14} />
                Raw markdown
              </a>
            </div>
          </div>
        </div>

        {readme ? (
          <div className="rounded-[12px] border border-border bg-card p-8">
            <Markdown content={readme} />
          </div>
        ) : (
          <EmptyState icon={FileText} title="No README available." className="min-h-[20vh]" />
        )}
      </div>
    </PageContainer>
  );
}
