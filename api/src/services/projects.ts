/**
 * Read-only integration with nearbuilders.org's Projects registry.
 *
 * Backs the project picker in the "request a round" form (#23): lets an owner
 * search real nearbuilders.org projects and resolve a slug to its canonical
 * project id, instead of typing an arbitrary free-text slug.
 *
 * Calls go through the `plugins.projects` contract+proxy attachment (typed
 * from nearbuilders.org's deployed contract). Responses are still parsed
 * through `NearBuildersProjectSchema`: the typed client replaces the
 * transport, not the trust boundary.
 *
 * Best-effort like `activity-events.ts`: an unreachable or absent
 * attachment returns null/empty rather than failing round creation, since the
 * picker degrades to free-text entry when disabled.
 */

import { type NearBuildersProject, NearBuildersProjectSchema } from "../contract";
import type { PluginsClient } from "../lib/plugins-types.gen";

export type { NearBuildersProject };

export type ProjectsRpcClient = ReturnType<PluginsClient["projects"]["client"]>;

const REQUEST_TIMEOUT_MS = 5000;

interface LookupLogger {
  warn(message: string): void;
}

export interface ProjectsLookupOptions {
  /** The `plugins.projects` contract+proxy client for nearbuilders.org; absent disables lookups. */
  client?: ProjectsRpcClient;
  logger?: LookupLogger;
}

export interface ProjectsLookup {
  /** True when the nearbuilders.org projects attachment is present. */
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

const callOptions = () => ({ signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

const rpcErrorCode = (error: unknown): string | null => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : null;
};

export function createProjectsLookup(options: ProjectsLookupOptions = {}): ProjectsLookup {
  const client = options.client;
  const logger = options.logger ?? console;
  const enabled = client !== undefined;

  async function read<T>(label: string, run: () => Promise<T>): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      const code = rpcErrorCode(error);
      if (code) {
        logger.warn(`[projects] ${label} rejected: ${code}`);
        return null;
      }
      logger.warn(
        `[projects] ${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async function listProjects(
    rpc: ProjectsRpcClient,
    input: Parameters<ProjectsRpcClient["listProjects"]>[0],
  ): Promise<NearBuildersProject[]> {
    const { data } = await rpc.listProjects(input, callOptions());
    return NearBuildersProjectSchema.array().parseAsync(data);
  }

  async function getProjectBySlug(
    rpc: ProjectsRpcClient,
    slug: string,
  ): Promise<NearBuildersProject | null> {
    try {
      const { data } = await rpc.getProjectBySlug({ slug }, callOptions());
      return await NearBuildersProjectSchema.parseAsync(data);
    } catch (error) {
      if (rpcErrorCode(error) === "NOT_FOUND") return null;
      throw error;
    }
  }

  return {
    enabled,

    search: async (query) => {
      if (!client) return null;
      const trimmed = query.trim();
      if (!trimmed) return [];
      return read("listProjects", () =>
        // `kind: project` keeps ideas, scopes and results out of the picker:
        // they are write-ups, not products anyone can be asked to test.
        // No `visibility`: omitting it lets unlisted projects (owner-named
        // for a feedback round, still not private) appear alongside public
        // ones; private is excluded upstream either way.
        listProjects(client, { query: trimmed, kind: "project" }),
      );
    },

    resolveBySlug: async (slug) => {
      if (!client) return null;
      return read("getProjectBySlug", () => getProjectBySlug(client, slug));
    },

    resolveMany: async (slugs) => {
      if (!client) return new Map();
      const unique = [...new Set(slugs)];
      const resolved = new Map<string, NearBuildersProject>();
      // One request per batch of slugs, so a long list stays a handful of
      // calls rather than one per project — and no slug is silently dropped.
      for (let i = 0; i < unique.length; i += MAX_SLUGS_PER_LOOKUP) {
        const batch = unique.slice(i, i + MAX_SLUGS_PER_LOOKUP);
        const result = await read("listProjectsBySlugs", () =>
          listProjects(client, { slugs: batch.join(","), limit: batch.length }),
        );
        for (const project of result ?? []) resolved.set(project.slug, project);
      }
      return resolved;
    },
  };
}
