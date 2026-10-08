/**
 * Read-only integration with nearbuilders.org's Projects registry.
 *
 * Backs the project picker in the "request a round" form (#23): lets an owner
 * search real nearbuilders.org projects and resolve a slug to its canonical
 * project id, instead of typing an arbitrary free-text slug.
 *
 * Best-effort like `activity-events.ts`: an unreachable or unconfigured
 * gateway returns null/empty rather than failing round creation, since the
 * picker degrades to free-text entry when disabled.
 */

import { type NearBuildersProject, ProjectsApiError, ProjectsClient } from "./projects-client";

const REQUEST_TIMEOUT_MS = 5000;

const SEARCH_LIMIT = 20;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface LookupLogger {
  warn(message: string): void;
}

export interface ProjectsLookupOptions {
  /** nearbuilders.org API base URL, e.g. `https://nearbuilders.org/api`. */
  baseUrl?: string | null;
  fetch?: FetchLike;
  logger?: LookupLogger;
}

export interface ProjectsLookup {
  /** True when a gateway base URL is configured. */
  readonly enabled: boolean;
  /** Search testable projects by title/slug; null if the gateway is unreachable. */
  search(query: string): Promise<NearBuildersProject[] | null>;
  /** Resolve a slug to its canonical project; null if not found or unreachable. */
  resolveBySlug(slug: string): Promise<NearBuildersProject | null>;
  /**
   * Resolve many slugs at once, keyed by slug. Rendering a list of projects
   * needs their registry metadata, and one request beats N round-trips.
   */
  resolveMany(slugs: string[]): Promise<Map<string, NearBuildersProject>>;
}

/** Keeps one batch request inside the gateway's page size. */
const MAX_SLUGS_PER_LOOKUP = 100;

export function createProjectsLookup(options: ProjectsLookupOptions = {}): ProjectsLookup {
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
  const logger = options.logger ?? console;
  const enabled = Boolean(baseUrl);

  const client = new ProjectsClient({
    apiBaseUrl: baseUrl,
    fetch: options.fetch,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  async function read<T>(label: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ProjectsApiError) {
        logger.warn(`[projects] ${label} rejected: HTTP ${error.status}`);
        return null;
      }
      logger.warn(
        `[projects] ${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  return {
    enabled,

    search: async (query) => {
      if (!enabled) return null;
      const trimmed = query.trim();
      if (!trimmed) return [];
      const result = await read("listProjects", () =>
        // `kind: project` keeps ideas, scopes and results out of the picker:
        // they are write-ups, not products anyone can be asked to test.
        // No `visibility`: omitting it lets unlisted projects (owner-named
        // for a feedback round, still not private) appear alongside public
        // ones; private is excluded upstream either way.
        client.listProjects({ query: trimmed, kind: "project", limit: SEARCH_LIMIT }),
      );
      return result?.data ?? null;
    },

    resolveBySlug: async (slug) => {
      if (!enabled) return null;
      return read("getProjectBySlug", () => client.getProjectBySlug(slug));
    },

    resolveMany: async (slugs) => {
      const unique = [...new Set(slugs)].slice(0, MAX_SLUGS_PER_LOOKUP);
      if (!enabled || unique.length === 0) return new Map();
      const result = await read("listProjectsBySlugs", () =>
        client.listProjects({ slugs: unique.join(","), limit: unique.length }),
      );
      return new Map((result?.data ?? []).map((project) => [project.slug, project]));
    },
  };
}
