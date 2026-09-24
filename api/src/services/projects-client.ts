/**
 * Typed client for nearbuilders.org's Projects plugin REST surface.
 *
 * Read-only: `listProjects` and `getProjectBySlug` are public routes with no
 * auth requirement (see nearbuilders.org's `plugins/projects/src/contract.ts`),
 * so unlike `ActivityClient` this never needs an API key.
 */

export type NearBuildersProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "project" | "idea" | "scope" | "result";
  status: "active" | "paused" | "archived";
  visibility: "private" | "unlisted" | "public";
};

export type NearBuildersProjectList = {
  data: NearBuildersProject[];
  meta: { total: number; hasMore: boolean; nextCursor: string | null };
};

export class ProjectsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProjectsApiError";
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProjectsClientOptions {
  apiBaseUrl: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export class ProjectsClient {
  readonly #apiBaseUrl: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs?: number;

  constructor(options: ProjectsClientOptions) {
    this.#apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs;
  }

  listProjects(input: {
    query?: string;
    visibility?: "public" | "unlisted" | "private";
    limit?: number;
  }): Promise<NearBuildersProjectList> {
    return this.#json(`/v1/projects${queryString(input)}`);
  }

  async getProjectBySlug(slug: string): Promise<NearBuildersProject | null> {
    try {
      const { data } = await this.#json<{ data: NearBuildersProject }>(
        `/v1/projects/by-slug/${encodeURIComponent(slug)}`,
      );
      return data;
    } catch (error) {
      if (error instanceof ProjectsApiError && error.status === 404) return null;
      throw error;
    }
  }

  async #json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.#fetch(`${this.#apiBaseUrl}${path}`, {
      ...init,
      signal: this.#timeoutMs != null ? AbortSignal.timeout(this.#timeoutMs) : init?.signal,
    });
    if (!response.ok) throw await projectsError(response);
    return response.json() as Promise<T>;
  }
}

function queryString(input: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function projectsError(response: Response): Promise<ProjectsApiError> {
  const fallback = `Projects API returned HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown; error?: { message?: unknown } };
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error?.message === "string"
          ? body.error.message
          : fallback;
    return new ProjectsApiError(response.status, message);
  } catch {
    return new ProjectsApiError(response.status, fallback);
  }
}
