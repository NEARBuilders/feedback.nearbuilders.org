import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectsLookup, type ProjectsRpcClient } from "@/services/projects";

const project = {
  id: "proj_1",
  slug: "onboarding-flow",
  title: "Onboarding Flow",
  description: "A NEAR builders project",
  kind: "project" as const,
  status: "active" as const,
  visibility: "public" as const,
  domain: "https://onboarding.example",
  repository: "https://github.com/near/onboarding",
  logoUrl: null,
};

const page = (data: unknown[]) => ({
  data,
  meta: { total: data.length, hasMore: false, nextCursor: null },
});

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;
let listProjects: ReturnType<typeof vi.fn>;
let getProjectBySlug: ReturnType<typeof vi.fn>;

function lookup() {
  const client = { listProjects, getProjectBySlug } as unknown as ProjectsRpcClient;
  return createProjectsLookup({ client, logger: { warn } });
}

beforeEach(() => {
  warn = vi.fn<(message: string) => void>();
  listProjects = vi.fn();
  getProjectBySlug = vi.fn();
});

describe("createProjectsLookup (disabled)", () => {
  it("is disabled and makes no request when the projects attachment is absent", async () => {
    const disabled = createProjectsLookup({ logger: { warn } });

    expect(disabled.enabled).toBe(false);
    expect(await disabled.search("onboarding")).toBeNull();
    expect(await disabled.resolveBySlug("onboarding-flow")).toBeNull();
    expect((await disabled.resolveMany(["onboarding-flow"])).size).toBe(0);
  });
});

describe("createProjectsLookup (enabled)", () => {
  it("searches only testable projects, excluding ideas and scopes", async () => {
    listProjects.mockResolvedValue(page([project]));

    expect(lookup().enabled).toBe(true);
    expect(await lookup().search("onboarding")).toEqual([project]);
    expect(listProjects).toHaveBeenCalledWith(
      { query: "onboarding", kind: "project" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("resolves many slugs in one batch request, keyed by slug", async () => {
    listProjects.mockResolvedValue(page([project]));

    const result = await lookup().resolveMany(["onboarding-flow", "missing", "onboarding-flow"]);

    expect(result.get("onboarding-flow")).toEqual(project);
    expect(result.has("missing")).toBe(false);
    expect(listProjects).toHaveBeenCalledTimes(1);
    expect(listProjects.mock.calls[0]?.[0]).toEqual({ slugs: "onboarding-flow,missing", limit: 2 });
  });

  it("splits long slug lists into batch requests instead of dropping the tail", async () => {
    listProjects.mockResolvedValue(page([]));

    const slugs = Array.from({ length: 150 }, (_, i) => `slug-${i}`);
    await lookup().resolveMany(slugs);

    expect(listProjects).toHaveBeenCalledTimes(2);
    const [first, second] = listProjects.mock.calls.map(([input]) => input);
    expect(first.limit).toBe(100);
    expect(first.slugs.startsWith("slug-0,")).toBe(true);
    expect(second.limit).toBe(50);
    expect(second.slugs.startsWith("slug-100,")).toBe(true);
  });

  it("makes no request when asked for no slugs", async () => {
    expect((await lookup().resolveMany([])).size).toBe(0);
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("skips the request and returns an empty list for a blank query", async () => {
    expect(await lookup().search("   ")).toEqual([]);
    expect(listProjects).not.toHaveBeenCalled();
  });

  it("returns null and logs when the search request is unreachable", async () => {
    listProjects.mockRejectedValue(new Error("ECONNREFUSED"));

    expect(await lookup().search("onboarding")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ECONNREFUSED");
  });

  it("resolves a slug to its canonical project", async () => {
    getProjectBySlug.mockResolvedValue({ data: project });

    expect(await lookup().resolveBySlug("onboarding-flow")).toEqual(project);
    expect(getProjectBySlug).toHaveBeenCalledWith(
      { slug: "onboarding-flow" },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns null for an unknown slug without warning", async () => {
    getProjectBySlug.mockRejectedValue(
      new ORPCError("NOT_FOUND", { message: "Project not found" }),
    );

    expect(await lookup().resolveBySlug("nope")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats NOT_FOUND from another oRPC module instance as an unknown slug", async () => {
    getProjectBySlug.mockRejectedValue(
      Object.assign(new Error("Project not found"), { code: "NOT_FOUND" }),
    );

    expect(await lookup().resolveBySlug("nope")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("normalizes omitted nullable fields to null (a registry that drops logoUrl must not 500 round reads)", async () => {
    const raw = {
      id: "proj_1",
      slug: "onboarding-flow",
      title: "Onboarding Flow",
      description: "A NEAR builders project",
      kind: "project",
      status: "active",
      visibility: "public",
      domain: "https://onboarding.example",
    };
    getProjectBySlug.mockResolvedValue({ data: raw });

    expect(await lookup().resolveBySlug("onboarding-flow")).toEqual({
      ...raw,
      repository: null,
      logoUrl: null,
    });
  });

  it("normalizes search results the same way", async () => {
    listProjects.mockResolvedValue(
      page([
        {
          id: "proj_1",
          slug: "onboarding-flow",
          title: "Onboarding Flow",
          description: null,
          kind: "project",
          status: "active",
          visibility: "public",
        },
      ]),
    );

    expect(await lookup().search("onboarding")).toEqual([
      {
        id: "proj_1",
        slug: "onboarding-flow",
        title: "Onboarding Flow",
        description: null,
        kind: "project",
        status: "active",
        visibility: "public",
        domain: null,
        repository: null,
        logoUrl: null,
      },
    ]);
  });

  it("returns null and logs when a registry response fails validation", async () => {
    getProjectBySlug.mockResolvedValue({ data: { ...project, kind: "something-new" } });

    expect(await lookup().resolveBySlug("onboarding-flow")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("returns null and logs when the resolve request rejects with a non-404 error", async () => {
    getProjectBySlug.mockRejectedValue(new ORPCError("INTERNAL_SERVER_ERROR", { message: "boom" }));

    expect(await lookup().resolveBySlug("onboarding-flow")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("INTERNAL_SERVER_ERROR");
  });
});
