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
  /** Search public projects by title/slug; null if the gateway is unreachable. */
  search(query: string): Promise<NearBuildersProject[] | null>;
  /** Resolve a slug to its canonical project; null if not found or unreachable. */
  resolveBySlug(slug: string): Promise<NearBuildersProject | null>;
}

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
        client.listProjects({ query: trimmed, visibility: "public", limit: 10 }),
      );
      return result?.data ?? null;
    },

    resolveBySlug: async (slug) => {
      if (!enabled) return null;
      return read("getProjectBySlug", () => client.getProjectBySlug(slug));
    },
  };
}
