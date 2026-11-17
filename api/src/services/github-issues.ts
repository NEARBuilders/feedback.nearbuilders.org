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
  now?: () => number;
}

const CLOSED_ROUND_TTL_MS = 6 * 60 * 60 * 1000;
const OPEN_ROUND_TTL_MS = 2 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 500;

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

export interface GithubIssuesResult {
  contributors: GithubIssueContributor[];
  /** True when the repo had more issues than the lookup is willing to page through. */
  truncated: boolean;
}

export interface GithubIssuesLookup {
  forRound(input: RoundGithubIssuesInput): Promise<GithubIssuesResult | null>;
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
  const now = options.now ?? Date.now;
  const cache = new Map<string, { expiresAt: number; value: Promise<GithubIssuesResult | null> }>();
  const client = new GithubClient({
    token: options.token || undefined,
    fetch: options.fetch,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  const compute = async ({
    repoUrl,
    windowStart,
    windowEnd,
  }: RoundGithubIssuesInput): Promise<GithubIssuesResult | null> => {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
      logger.warn(`[github-issues] repoUrl is not a github.com repo: ${repoUrl}`);
      return null;
    }

    let issues: GithubIssue[];
    let truncated: boolean;
    try {
      ({ issues, truncated } = await client.listRepoIssues({
        owner: parsed.owner,
        repo: parsed.repo,
        since: windowStart,
      }));
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
    const end = windowEnd ? new Date(windowEnd).getTime() : now();
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

    return {
      contributors: [...byContributor.values()].sort((a, b) => a.login.localeCompare(b.login)),
      truncated,
    };
  };

  return {
    forRound: (input) => {
      const key = `${input.repoUrl}|${input.windowStart}|${input.windowEnd ?? ""}`;
      const current = now();
      const hit = cache.get(key);
      if (hit && hit.expiresAt > current) return hit.value;

      const value = compute(input);
      const entry = { expiresAt: current + FAILURE_TTL_MS, value };
      cache.delete(key);
      cache.set(key, entry);
      while (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      void value.then((result) => {
        if (result) {
          entry.expiresAt = now() + (input.windowEnd ? CLOSED_ROUND_TTL_MS : OPEN_ROUND_TTL_MS);
        }
      });
      return value;
    },
  };
}
