import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGithubIssuesLookup, parseGithubRepo } from "@/services/github-issues";

function rawIssue(overrides: Record<string, unknown> & { number?: number } = {}) {
  const number = overrides.number ?? 1;
  return {
    number,
    title: "Something is broken",
    html_url: `https://github.com/near/feedback/issues/${number}`,
    created_at: "2026-04-02T12:00:00.000Z",
    user: { login: "alice" },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
});

describe("parseGithubRepo", () => {
  it("parses owner/repo from a github.com URL", () => {
    expect(parseGithubRepo("https://github.com/near/feedback")).toEqual({
      owner: "near",
      repo: "feedback",
    });
  });

  it("strips a trailing .git and extra path segments", () => {
    expect(parseGithubRepo("https://github.com/near/feedback.git")).toEqual({
      owner: "near",
      repo: "feedback",
    });
    expect(parseGithubRepo("https://www.github.com/near/feedback/")).toEqual({
      owner: "near",
      repo: "feedback",
    });
  });

  it("returns null for a non-github.com host", () => {
    expect(parseGithubRepo("https://gitlab.com/near/feedback")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(parseGithubRepo("not-a-url")).toBeNull();
  });
});

describe("createGithubIssuesLookup", () => {
  const round = {
    repoUrl: "https://github.com/near/feedback",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-10T00:00:00.000Z",
  };

  it("returns null and logs, without fetching, for a non-github repoUrl", async () => {
    const fetchMock = vi.fn();
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound({ ...round, repoUrl: "https://gitlab.com/near/feedback" });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("groups issues filed inside the window by contributor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          rawIssue({ number: 1, user: { login: "bob" }, created_at: "2026-04-05T00:00:00.000Z" }),
          rawIssue({ number: 2, user: { login: "alice" }, created_at: "2026-04-06T00:00:00.000Z" }),
          rawIssue({ number: 3, user: { login: "alice" }, created_at: "2026-04-07T00:00:00.000Z" }),
        ]),
      );
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound(round);

    expect(result).toEqual([
      {
        login: "alice",
        issues: [
          {
            number: 2,
            title: "Something is broken",
            url: "https://github.com/near/feedback/issues/2",
            createdAt: "2026-04-06T00:00:00.000Z",
          },
          {
            number: 3,
            title: "Something is broken",
            url: "https://github.com/near/feedback/issues/3",
            createdAt: "2026-04-07T00:00:00.000Z",
          },
        ],
      },
      {
        login: "bob",
        issues: [
          {
            number: 1,
            title: "Something is broken",
            url: "https://github.com/near/feedback/issues/1",
            createdAt: "2026-04-05T00:00:00.000Z",
          },
        ],
      },
    ]);
  });

  it("requests the repo's issues with state=all and the round start as `since`", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    await lookup.forRound(round);

    const [url] = fetchMock.mock.calls[0] as [string];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.github.com/repos/near/feedback/issues",
    );
    expect(parsed.searchParams.get("state")).toBe("all");
    expect(parsed.searchParams.get("since")).toBe(round.windowStart);
  });

  it("sends an authorization header when a token is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    const lookup = createGithubIssuesLookup({
      fetch: fetchMock,
      token: "gh_secret",
      logger: { warn },
    });

    await lookup.forRound(round);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer gh_secret");
  });

  it("excludes pull requests returned by the issues endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          rawIssue({ number: 4, user: { login: "carol" }, pull_request: { url: "..." } }),
          rawIssue({ number: 5, user: { login: "carol" } }),
        ]),
      );
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound(round);

    expect(result).toEqual([{ login: "carol", issues: [expect.objectContaining({ number: 5 })] }]);
  });

  it("excludes issues filed outside the round window", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          rawIssue({ number: 6, created_at: "2026-03-31T23:59:59.000Z" }),
          rawIssue({ number: 7, created_at: "2026-04-10T00:00:01.000Z" }),
        ]),
      );
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound(round);

    expect(result).toEqual([]);
  });

  it("treats a null windowEnd as still open, up to now", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([rawIssue({ number: 8, created_at: new Date().toISOString() })]),
      );
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound({ ...round, windowEnd: null });

    expect(result).toEqual([{ login: "alice", issues: [expect.objectContaining({ number: 8 })] }]);
  });

  it("paginates until a page comes back short", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      rawIssue({ number: i + 1, html_url: `https://github.com/near/feedback/issues/${i + 1}` }),
    );
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const page = new URL(url).searchParams.get("page");
      return jsonResponse(page === "1" ? fullPage : [rawIssue({ number: 101 })]);
    });
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound({
      ...round,
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-12-31T00:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.[0]?.issues).toHaveLength(101);
  });

  it("returns null and logs when the GitHub API rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Not Found" }, 404));
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound(round);

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("HTTP 404");
  });

  it("returns null and logs when the GitHub API is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const lookup = createGithubIssuesLookup({ fetch: fetchMock, logger: { warn } });

    const result = await lookup.forRound(round);

    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });
});
