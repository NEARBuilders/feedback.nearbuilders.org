/**
 * Producer-side integration with activity.nearbuilders.org.
 *
 * feedback.nearbuilders.org is registered as an Activity Source and emits
 * events for a round opening, feedback being posted, a round closing, and
 * credit being awarded, so activity's feed and leaderboard can pick this app
 * up. This is a producer integration only — feedback keeps its own database;
 * there are no shared tables and no Nostr/Redis here.
 *
 * Every emit is best-effort: a failed, rejected, or unreachable gateway is
 * logged and swallowed, and never blocks or fails the local action that
 * triggered it. Submissions carry an idempotency key scoped to the round,
 * feedback, or credit, so a retry of the same logical event is de-duplicated
 * by the gateway (see docs/integration-guide.md in activity.nearbuilders.org).
 *
 * Wire plumbing (submit/listEvents/leaderboard/retract) lives in
 * `./activity-client`, the ported activity.nearbuilders.org reference client.
 */

import { ActivityApiError, ActivityClient, type JsonValue } from "./activity-client";

export type ActivityEventType =
  | "round.opened"
  | "feedback.posted"
  | "round.closed"
  | "credit.awarded";

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

export interface RoundClosedInput {
  id: string;
  ownerAccountId: string;
  projectSlug: string;
  title: string;
}

export interface CreditAwardedInput {
  roundId: string;
  builderAccountId: string;
  projectSlug: string;
  roundTitle: string;
  writtenCount: number;
  recordedCount: number;
  summary: string | null;
}

export interface ActivityEmitter {
  /** True when a gateway URL and API key are configured. */
  readonly enabled: boolean;
  emitRoundOpened(round: RoundOpenedInput): Promise<void>;
  emitFeedbackPosted(feedback: FeedbackPostedInput): Promise<void>;
  emitRoundClosed(round: RoundClosedInput): Promise<void>;
  emitCreditAwarded(credit: CreditAwardedInput): Promise<void>;
}

interface ActivityEventSubmission {
  eventType: ActivityEventType;
  actor: string;
  idempotencyKey: string;
  payload: Record<string, JsonValue>;
}

export function createActivityEmitter(options: ActivityEmitterOptions = {}): ActivityEmitter {
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
  const apiKey = options.apiKey ?? "";
  const logger = options.logger ?? console;
  const enabled = Boolean(baseUrl && apiKey);

  const client = new ActivityClient({
    apiBaseUrl: baseUrl,
    apiKey: apiKey || undefined,
    fetch: options.fetch,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });

  async function submit(event: ActivityEventSubmission): Promise<void> {
    if (!enabled) return;

    try {
      await client.submit(event);
    } catch (error) {
      if (error instanceof ActivityApiError) {
        logger.warn(
          `[activity] ${event.eventType} (${event.idempotencyKey}) rejected: HTTP ${error.status}`,
        );
        return;
      }
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

    emitRoundClosed: (round) =>
      submit({
        eventType: "round.closed",
        actor: round.ownerAccountId,
        idempotencyKey: `round.closed:${round.id}`,
        payload: {
          roundId: round.id,
          projectSlug: round.projectSlug,
          title: round.title,
        },
      }),

    emitCreditAwarded: (credit) =>
      submit({
        eventType: "credit.awarded",
        actor: credit.builderAccountId,
        idempotencyKey: `credit.awarded:${credit.roundId}:${credit.builderAccountId}`,
        payload: {
          roundId: credit.roundId,
          projectSlug: credit.projectSlug,
          roundTitle: credit.roundTitle,
          writtenCount: credit.writtenCount,
          recordedCount: credit.recordedCount,
          summary: credit.summary,
        },
      }),
  };
}
