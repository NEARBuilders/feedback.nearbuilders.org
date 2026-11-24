import { ORPCError } from "@orpc/server";
import { createRateLimiter, type RateLimiter } from "../lib/rate-limit";

/** What the guard reads from a request. A subset of the host's auth context. */
export interface TesterKeyContext {
  apiKey?: { id?: string | null } | null;
  user?: { id?: string | null } | null;
  userId?: string | null;
  principal?: { type?: string | null } | null;
}

/** Joins and posts a key-based tester may make per minute, per user. */
export const TESTER_KEY_LIMIT = 30;
const WINDOW_MS = 60_000;

export const createTesterKeyLimiter = (): RateLimiter =>
  createRateLimiter({ limit: TESTER_KEY_LIMIT, windowMs: WINDOW_MS });

/**
 * Guards the tester actions (join a round, post feedback) for key-based callers (#298, #322).
 *
 * - A session passes untouched.
 * - A personal `api_…` key passes when the host attached the key owner's user, and is
 *   rate limited per user so an agent can't flood a round.
 * - A key with no user is refused with a message that says which case it is, instead of the
 *   generic "Authentication required", so a failed call tells you what the host did.
 */
export function assertTesterKeyAllowed(
  context: TesterKeyContext,
  limiter: RateLimiter,
  action: "join" | "post",
): void {
  if (!context.apiKey) return;
  const hasUser = !!context.user && !!context.userId;
  if (!hasUser) {
    const orgKey = context.principal?.type === "organization";
    throw new ORPCError("UNAUTHORIZED", {
      message: orgKey
        ? "Organization keys can't take part in a round, use a personal key or sign in"
        : "This API key isn't tied to a user, so it can't take part in a round",
      data: {
        hint: orgKey
          ? "Create a personal api_ key from your account settings"
          : "Use a personal api_ key that belongs to a user with a linked NEAR account",
        keyKind: orgKey ? "organization" : "no-user",
      },
    });
  }
  if (!limiter.allow(`tester-key:${action}:${context.userId}`)) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many requests from this key, wait a minute and try again",
      data: { hint: `At most ${TESTER_KEY_LIMIT} per minute`, retryAfterSeconds: 60 },
    });
  }
}
