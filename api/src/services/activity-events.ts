/**
 * Producer-side client for activity.nearbuilders.org.
 *
 * feedback.nearbuilders.org is registered as an Activity Source and emits one
 * event when a round opens and one when feedback is posted, so activity's feed
 * and leaderboard can pick this app up. This is a producer integration only —
 * feedback keeps its own database; there are no shared tables and no Nostr/Redis
 * here.
 *
 * Every emit is best-effort: a failed, rejected, or unreachable gateway is
 * logged and swallowed, and never blocks or fails the local action that
 * triggered it. Submissions carry an idempotency key scoped to the round or
 * feedback id, so a retry of the same logical event is de-duplicated by the
 * gateway (see docs/integration-guide.md in activity.nearbuilders.org).
 */

export type ActivityEventType = "round.opened" | "feedback.posted";

const REQUEST_TIMEOUT_MS = 5000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface EmitterLogger {
  warn(message: string): void;
}

export interface ActivityEmitterOptions {
  /** Activity API gateway base URL, e.g. `https://activity.nearbuilders.org/api`. */
  baseUrl?: string | null;
  /** Source API Key (`act_…`). Server-side bearer credential. */
  apiKey?: string | null;
  fetch?: FetchLike;
  logger?: EmitterLogger;
}

export interface RoundOpenedInput {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  title: string;
  formats: string[];
  repoUrl: string | null;
}

export interface FeedbackPostedInput {
  id: string;
  roundId: string;
  authorAccountId: string;
  format: string;
}

export interface ActivityEmitter {
  /** True when a gateway URL and API key are configured. */
  readonly enabled: boolean;
  emitRoundOpened(round: RoundOpenedInput): Promise<void>;
  emitFeedbackPosted(feedback: FeedbackPostedInput): Promise<void>;
}

interface ActivityEventSubmission {
  eventType: ActivityEventType;
  actor: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export function createActivityEmitter(options: ActivityEmitterOptions = {}): ActivityEmitter {
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
  const apiKey = options.apiKey ?? "";
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const logger = options.logger ?? console;
  const enabled = Boolean(baseUrl && apiKey);

  async function submit(event: ActivityEventSubmission): Promise<void> {
    if (!enabled) return;

    try {
      const response = await doFetch(`${baseUrl}/v1/events`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok) return;

      logger.warn(
        `[activity] ${event.eventType} (${event.idempotencyKey}) rejected: HTTP ${response.status}`,
      );
    } catch (error) {
      logger.warn(
        `[activity] ${event.eventType} (${event.idempotencyKey}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    enabled,

    emitRoundOpened: (round) =>
      submit({
        eventType: "round.opened",
        actor: round.ownerAccountId,
        idempotencyKey: `round.opened:${round.id}`,
        payload: {
          roundId: round.id,
          projectSlug: round.projectSlug,
          title: round.title,
          formats: round.formats,
          repoUrl: round.repoUrl,
        },
      }),

    emitFeedbackPosted: (feedback) =>
      submit({
        eventType: "feedback.posted",
        actor: feedback.authorAccountId,
        idempotencyKey: `feedback.posted:${feedback.id}`,
        payload: {
          feedbackId: feedback.id,
          roundId: feedback.roundId,
          format: feedback.format,
        },
      }),
  };
}
