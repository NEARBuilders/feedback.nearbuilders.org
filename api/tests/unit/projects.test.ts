import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectsLookup } from "@/services/projects";

const project = {
  id: "proj_1",
  slug: "onboarding-flow",
  title: "Onboarding Flow",
  description: "A NEAR builders project",
  kind: "project" as const,
  status: "active" as const,
  visibility: "public" as const,
};

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
});

describe("createProjectsLookup (disabled)", () => {
  it("is disabled and makes no request when no base URL is configured", async () => {
    const fetchMock = vi.fn();
    const lookup = createProjectsLookup({ fetch: fetchMock, logger: { warn } });

    expect(lookup.enabled).toBe(false);
    expect(await lookup.search("onboarding")).toBeNull();
    expect(await lookup.resolveBySlug("onboarding-flow")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createProjectsLookup (enabled)", () => {
  const config = { baseUrl: "https://nearbuilders.org/api" };

  it("searches public projects by query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [project], meta: { total: 1, hasMore: false, nextCursor: null } }),
    } as Response);
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    const result = await lookup.search("onboarding");

    expect(result).toEqual([project]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      "https://nearbuilders.org/api/v1/projects?query=onboarding&visibility=public&limit=10",
    );
  });

  it("skips the request and returns an empty list for a blank query", async () => {
    const fetchMock = vi.fn();
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.search("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null and logs when the search request is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.search("onboarding")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });

  it("resolves a slug to its canonical project", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: project }),
    } as Response);
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    const result = await lookup.resolveBySlug("onboarding-flow");

    expect(result).toEqual(project);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://nearbuilders.org/api/v1/projects/by-slug/onboarding-flow");
  });

  it("returns null for an unknown slug without warning", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Project not found" }),
    } as Response);
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.resolveBySlug("nope")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null and logs when the resolve request rejects with a non-404 error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "boom" }),
    } as Response);
    const lookup = createProjectsLookup({ ...config, fetch: fetchMock, logger: { warn } });

    expect(await lookup.resolveBySlug("onboarding-flow")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("HTTP 500");
  });
});
