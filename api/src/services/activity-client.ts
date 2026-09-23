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

export class ActivityEventStream {
  readonly #reader: ReadableStreamDefaultReader<Uint8Array>;
  readonly #controller: AbortController;
  readonly #timeout: ReturnType<typeof setTimeout>;
  readonly #decoder = new TextDecoder();
  #buffered = "";
  #closed = false;

  constructor(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    controller: AbortController,
    timeout: ReturnType<typeof setTimeout>,
  ) {
    this.#reader = reader;
    this.#controller = controller;
    this.#timeout = timeout;
  }

  async nextEvent(): Promise<ActivityEvent> {
    while (true) {
      const { done, value } = await this.#reader.read();
      if (done) throw new Error("Activity event stream ended before an event arrived");
      this.#buffered += this.#decoder.decode(value, { stream: true });
      this.#buffered = this.#buffered.replaceAll("\r\n", "\n");
      let boundary = this.#buffered.indexOf("\n\n");
      while (boundary >= 0) {
        const block = this.#buffered.slice(0, boundary);
        this.#buffered = this.#buffered.slice(boundary + 2);
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (data) return JSON.parse(data) as ActivityEvent;
        boundary = this.#buffered.indexOf("\n\n");
      }
    }
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    clearTimeout(this.#timeout);
    this.#controller.abort();
    await this.#reader.cancel().catch(() => undefined);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ActivityClientOptions {
  apiBaseUrl: string;
  apiKey?: string;
  fetch?: FetchLike;
  /** Applied to non-streaming requests only; `openEventStream` manages its own timeout. */
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

  async openEventStream(
    input: { source?: string; type?: string; actor?: string },
    options: { timeoutMs?: number; lastEventId?: string } = {},
  ): Promise<ActivityEventStream> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("The operation timed out.", "TimeoutError")),
      options.timeoutMs ?? 10_000,
    );
    try {
      const response = await this.#fetch(
        `${this.#apiBaseUrl}/v1/events/stream${queryString(input)}`,
        {
          headers: {
            accept: "text/event-stream",
            ...(options.lastEventId ? { "last-event-id": options.lastEventId } : {}),
          },
          signal: controller.signal,
        },
      );
      if (!response.ok || !response.body) {
        clearTimeout(timeout);
        throw await activityError(response);
      }
      return new ActivityEventStream(response.body.getReader(), controller, timeout);
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
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
