/**
 * Best-effort publisher for feedback submissions as Nostr comment events on
 * nostr.nearbuilders.org, so feedback content is portable and agent-readable
 * per #32, without feedback.nearbuilders.org losing its own Postgres copy
 * (which stays the reliable read path — see PR description for why this is
 * additive, not a swap).
 *
 * Keying matches the scheme agreed with the nostr plugin owner: a single
 * `project-feedback:<projectSlug>` near_target (so "all feedback for a
 * project" stays one relay query, avoiding a key per round), plus a `round`
 * tag carrying the round's per-project incrementing number (not its uuid) so
 * "feedback for this round" is a second, combinable relay-side filter.
 *
 * feedback.nearbuilders.org signs with its own service Nostr identity (there
 * is no per-user Nostr key yet) and records the real submitter in the
 * `near_account` tag, mirroring nostr.nearbuilders.org's own attribution
 * convention (see NostrComment.nearAccountId in that repo).
 */

import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";
import type { PluginsClient } from "../lib/plugins-types.gen";

const TARGET_TYPE = "project-feedback";
const COMMENT_KIND = 1111;

interface EmitterLogger {
  warn(message: string): void;
}

export interface FeedbackNostrInput {
  projectSlug: string;
  roundNumber: number;
  format: "written" | "recorded";
  content: string;
  authorAccountId: string;
}

export interface FeedbackNostrEmitter {
  /** True when a service signing key is configured. */
  readonly enabled: boolean;
  /** Returns the published event id on success, or null if disabled/failed. */
  publish(input: FeedbackNostrInput, context: Record<string, unknown>): Promise<string | null>;
}

export interface FeedbackNostrOptions {
  nostr: PluginsClient["nostr"];
  /** Hex-encoded secp256k1 secret key for this app's service Nostr identity. */
  secretKeyHex?: string | null;
  clientName?: string;
  logger?: EmitterLogger;
}

export function createFeedbackNostrEmitter(options: FeedbackNostrOptions): FeedbackNostrEmitter {
  const logger = options.logger ?? console;
  const clientName = options.clientName || "feedback.nearbuilders.org";
  const secretKeyHex = options.secretKeyHex ?? "";
  const enabled = Boolean(secretKeyHex);
  const secretKey = enabled ? hexToBytes(secretKeyHex) : null;
  const pubkey = secretKey ? getPublicKey(secretKey) : null;

  return {
    enabled,

    async publish(input, context) {
      if (!enabled || !secretKey || !pubkey) return null;

      try {
        const tags: string[][] = [
          ["t", TARGET_TYPE],
          ["t", clientName],
          ["p", pubkey],
          ["client", clientName],
          ["near_target", `${TARGET_TYPE}:${input.projectSlug}`],
          ["near_account", input.authorAccountId],
          ["round", String(input.roundNumber)],
          ["format", input.format],
        ];

        const event = finalizeEvent(
          {
            kind: COMMENT_KIND,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: input.content,
          },
          secretKey,
        );

        const result = await options.nostr(context).createComment({
          event,
          target: input.projectSlug,
          targetType: TARGET_TYPE,
          adapterType: "standard",
        });

        return result.eventId;
      } catch (error) {
        logger.warn(
          `[nostr] feedback comment publish failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    },
  };
}
