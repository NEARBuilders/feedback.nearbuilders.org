/**
 * Reads issues filed on a round's GitHub repo during its window, grouped by
 * contributor (issue #49 / README `GET /api/v1/rounds/{id}/github-issues`).
 *
 * Best-effort like `projects.ts`: an unreachable GitHub API, a repo that
 * isn't on github.com, or a rate-limit rejection returns null rather than
 * failing the request, since this is a read of someone else's tracker, not
 * data this app owns.
 */

import { GithubApiError, GithubClient, type GithubIssue } from "./github-client";

const REQUEST_TIMEOUT_MS = 8000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface LookupLogger {
  warn(message: string): void;
}

export interface GithubIssuesLookupOptions {
  /** Optional PAT to raise the GitHub API rate limit from 60/hr to 5000/hr. */
  token?: string | null;
  fetch?: FetchLike;
  logger?: LookupLogger;
}

export interface RoundGithubIssuesInput {
  repoUrl: string;
  /** Round's created-at; issues filed before this don't count. */
  windowStart: string;
  /** Round's closed-at, or null while still open (treated as "up to now"). */
  windowEnd: string | null;
}

export interface GithubIssueSummary {
  number: number;
  title: string;
  url: string;
  createdAt: string;
}

export interface GithubIssueContributor {
  login: string;
  issues: GithubIssueSummary[];
}

export interface GithubIssuesLookup {
  forRound(input: RoundGithubIssuesInput): Promise<GithubIssueContributor[] | null>;
}

export function parseGithubRepo(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const [owner, repo] = url.pathname
      .replace(/^\/+/, "")
      .replace(/\.git$/, "")
      .split("/");
    if (!owner || !repo) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

export function createGithubIssuesLookup(
  options: GithubIssuesLookupOptions = {},
): GithubIssuesLookup {
  const logger = options.logger ?? console;
  const client = new GithubClient({
    token: options.token || undefined,
    fetch: options.fetch,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  return {
    forRound: async ({ repoUrl, windowStart, windowEnd }) => {
      const parsed = parseGithubRepo(repoUrl);
      if (!parsed) {
        logger.warn(`[github-issues] repoUrl is not a github.com repo: ${repoUrl}`);
        return null;
      }

      let issues: GithubIssue[];
      try {
        issues = await client.listRepoIssues({
          owner: parsed.owner,
          repo: parsed.repo,
          since: windowStart,
        });
      } catch (error) {
        if (error instanceof GithubApiError) {
          logger.warn(`[github-issues] listRepoIssues rejected: HTTP ${error.status}`);
        } else {
          logger.warn(
            `[github-issues] listRepoIssues failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return null;
      }

      const start = new Date(windowStart).getTime();
      const end = windowEnd ? new Date(windowEnd).getTime() : Date.now();
      const byContributor = new Map<string, GithubIssueContributor>();

      for (const issue of issues) {
        if (!issue.login) continue;
        const createdAt = new Date(issue.createdAt).getTime();
        if (createdAt < start || createdAt > end) continue;

        const entry = byContributor.get(issue.login) ?? { login: issue.login, issues: [] };
        entry.issues.push({
          number: issue.number,
          title: issue.title,
          url: issue.htmlUrl,
          createdAt: issue.createdAt,
        });
        byContributor.set(issue.login, entry);
      }

      return [...byContributor.values()].sort((a, b) => a.login.localeCompare(b.login));
    },
  };
}
