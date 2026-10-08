/**
 * Typed client for activity.nearbuilders.org's HTTP gateway.
 *
 * Ported from activity.nearbuilders.org's `examples/activity-client.ts` (the
 * upstream reference client, CI-proven against the real gateway) plus a
 * `retract` method matching the real contract's `retractActivityEvent` route,
 * which predates that example file.
 *
 * See docs/integration-guide.md and docs/activity-protocol.md in
 * activity.nearbuilders.org for the wire protocol this implements.
 */

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ActivityEvent = {
  id: string;
  source: string;
  type: string;
  actor: string;
  idempotencyKey: string;
  timestamp: string;
  payload: JsonValue;
  provenance: {
    signatureVerified: true;
    publicKey: string;
    signingIdentityStatus: "active" | "retired";
    sourceDisplayName: string;
    integration: "github" | null;
    trustStatus: "standard" | "trusted";
    scoreMultiplier: number;
    payloadClaimsVerified: false;
  };
};

export type ActivityFeed = {
  data: ActivityEvent[];
  meta: { hasMore: boolean; nextCursor: string | null; skippedInvalid: number };
};

export type ActivityLeaderboard = {
  period: "weekly" | "monthly" | "all-time";
  data: Array<{
    rank: number;
    actor: string;
    score: number;
    eventCount: number;
    breakdown: Array<{
      source: string;
      type: string;
      pointValue: number;
      eventCount: number;
      score: number;
    }>;
  }>;
};

export type ActivityEndorsement = {
  eventId: string;
  totalCount: number;
  endorsedByCurrentUser: boolean;
};

export type ActivityRetractResult = {
  hiddenEvent: { eventId: string; reason: string; [key: string]: JsonValue | string };
  projection: {
    updateId: string;
    operation: "exclude";
    eventId: string;
    source: string;
    type: string;
    actor: string;
    idempotencyKey: string;
    eventTimestamp: string;
  };
};

export class ActivityApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ActivityApiError";
    this.status = status;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ActivityClientOptions {
  apiBaseUrl: string;
  apiKey?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
}

export class ActivityClient {
  readonly #apiBaseUrl: string;
  readonly #apiKey?: string;
  readonly #fetch: FetchLike;
  readonly #timeoutMs?: number;

  constructor(options: ActivityClientOptions) {
    this.#apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#timeoutMs = options.timeoutMs;
  }

  submit(input: {
    eventType: string;
    actor: string;
    idempotencyKey: string;
    payload: JsonValue;
  }): Promise<{ eventId: string }> {
    if (!this.#apiKey) throw new Error("Activity Source API Key is required for submission");
    return this.#json("/v1/events", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
  }

  /** Hides an event this source published. Requires the Source API Key. */
  retract(
    eventId: string,
    input: { reason: string; idempotencyKey: string },
  ): Promise<ActivityRetractResult> {
    if (!this.#apiKey) throw new Error("Activity Source API Key is required to retract an event");
    return this.#json(`/v1/events/${eventId}/retract`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
  }

  listEvents(input: {
    source?: string;
    type?: string;
    actor?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ActivityFeed> {
    return this.#json(`/v1/events${queryString(input)}`);
  }

  /** Counts for up to 100 events in one request, keyed by event id. */
  endorsements(eventIds: string[]): Promise<Record<string, ActivityEndorsement>> {
    return this.#json("/v1/events/endorsements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventIds }),
    });
  }

  leaderboard(input: {
    period: "weekly" | "monthly" | "all-time";
    source?: string;
    type?: string;
    limit?: number;
  }): Promise<ActivityLeaderboard> {
    return this.#json(`/v1/leaderboard${queryString(input)}`);
  }

  async #json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.#fetch(`${this.#apiBaseUrl}${path}`, {
      ...init,
      signal: this.#timeoutMs != null ? AbortSignal.timeout(this.#timeoutMs) : init?.signal,
    });
    if (!response.ok) throw await activityError(response);
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

async function activityError(response: Response): Promise<ActivityApiError> {
  const fallback = `Activity API returned HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown; error?: { message?: unknown } };
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error?.message === "string"
          ? body.error.message
          : fallback;
    return new ActivityApiError(response.status, message);
  } catch {
    return new ActivityApiError(response.status, fallback);
  }
}
