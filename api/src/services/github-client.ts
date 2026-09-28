/**
 * Typed client for GitHub's REST API, scoped to the one thing this app needs:
 * reading issues filed on a round's repo (README "No pasted links for GitHub
 * credit" — credit is pulled from the GitHub API by repository and
 * contributor, not by parsing pasted links).
 *
 * Unauthenticated requests work against public repos but are rate-limited to
 * 60/hour; passing a token raises that to 5000/hour. See services/github-issues.ts.
 */

export type GithubIssue = {
  number: number;
  title: string;
  htmlUrl: string;
  createdAt: string;
  login: string | null;
};

export class GithubApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GithubApiError";
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GithubClientOptions {
  apiBaseUrl?: string;
  token?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

type RawGithubIssue = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  pull_request?: unknown;
  user: { login: string } | null;
};

const DEFAULT_PER_PAGE = 100;
// Safety cap so a very active repo can't turn this into an unbounded fetch loop.
const MAX_PAGES = 10;

export class GithubClient {
  readonly #apiBaseUrl: string;
  readonly #token?: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs?: number;

  constructor(options: GithubClientOptions = {}) {
    this.#apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.#token = options.token;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs;
  }

  /**
   * Lists issues on a repo, newest-first filtering excluded: sorted by
   * creation ascending. `since` narrows by last-updated time (GitHub's own
   * semantics), so callers must still filter the result by `createdAt` for an
   * exact window. Pull requests (which this endpoint also returns) are
   * dropped, since only real issues count per README.
   */
  async listRepoIssues(input: {
    owner: string;
    repo: string;
    since?: string;
  }): Promise<GithubIssue[]> {
    const issues: GithubIssue[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const query = new URLSearchParams({
        state: "all",
        per_page: String(DEFAULT_PER_PAGE),
        page: String(page),
        sort: "created",
        direction: "asc",
      });
      if (input.since) query.set("since", input.since);

      const batch = await this.#json<RawGithubIssue[]>(
        `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues?${query.toString()}`,
      );
      for (const raw of batch) {
        if ("pull_request" in raw && raw.pull_request) continue;
        issues.push({
          number: raw.number,
          title: raw.title,
          htmlUrl: raw.html_url,
          createdAt: raw.created_at,
          login: raw.user?.login ?? null,
        });
      }
      if (batch.length < DEFAULT_PER_PAGE) break;
    }
    return issues;
  }

  async #json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.#fetch(`${this.#apiBaseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(this.#token ? { authorization: `Bearer ${this.#token}` } : {}),
        ...init?.headers,
      },
      signal: this.#timeoutMs != null ? AbortSignal.timeout(this.#timeoutMs) : init?.signal,
    });
    if (!response.ok) throw await githubError(response);
    return response.json() as Promise<T>;
  }
}

async function githubError(response: Response): Promise<GithubApiError> {
  const fallback = `GitHub API returned HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = typeof body.message === "string" ? body.message : fallback;
    return new GithubApiError(response.status, message);
  } catch {
    return new GithubApiError(response.status, fallback);
  }
}
