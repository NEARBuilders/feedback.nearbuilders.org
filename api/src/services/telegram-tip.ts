/**
 * Telegram tipping (#105): resolve a tester's Telegram handle from their NEAR account and build
 * the message a round manager sends to the tip bot.
 *
 * Handle sources, in order:
 * 1. the nearbuilders.org builders API (`links.telegram`, a full `https://t.me/...` URL);
 * 2. the NEAR Social profile (`linktree.telegram`).
 *
 * Best-effort like `projects.ts`: an unreachable source is skipped and, if nothing resolves,
 * the caller gets "no handle" rather than an error.
 */

const REQUEST_TIMEOUT_MS = 5000;
const NEAR_SOCIAL_API = "https://api.near.social";
export const DEFAULT_TIP_MESSAGE_TEMPLATE = "/tip @{handle}";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface LookupLogger {
  warn(message: string): void;
}

export type TelegramHandleSource = "nearbuilders" | "near-social";

export interface TelegramHandleResult {
  /** Bare handle without `@`, or null when none is linked. */
  handle: string | null;
  source: TelegramHandleSource | null;
  /** False when every source failed, so "no handle" may just mean "couldn't check". */
  available: boolean;
}

export interface TelegramTip extends TelegramHandleResult {
  /** The tip-bot message addressed to the handle; null without one. */
  message: string | null;
  /** `t.me` deep link that opens Telegram with the message ready to send; null without a handle. */
  shareUrl: string | null;
}

export interface TelegramTipLookupOptions {
  /** nearbuilders.org API base URL, e.g. `https://nearbuilders.org/api`. */
  baseUrl?: string | null;
  /** Message template with `{handle}` and `{account}` placeholders. */
  messageTemplate?: string | null;
  fetch?: FetchLike;
  logger?: LookupLogger;
}

export interface TelegramTipLookup {
  resolveHandle(nearAccountId: string): Promise<TelegramHandleResult>;
  /** Handle plus the ready-to-send tip message and deep link. */
  getTip(nearAccountId: string): Promise<TelegramTip>;
}

const HANDLE_PATTERN = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

/** t.me path prefixes that look like usernames but are invite links, channels and tools. */
const NON_USER_PATHS = new Set(["joinchat", "addstickers", "addemoji", "share", "proxy", "socks"]);

/**
 * Normalizes `https://t.me/alice`, `t.me/alice/123`, `telegram.me/alice`, `@alice` and `alice`
 * to the bare handle, or null when it isn't a plausible Telegram username.
 */
export function normalizeTelegramHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let handle = value.trim();
  handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\//i, "");
  handle = handle.replace(/^@/, "");
  handle = handle.split(/[/?#]/)[0] ?? "";
  return HANDLE_PATTERN.test(handle) && !NON_USER_PATHS.has(handle.toLowerCase()) ? handle : null;
}

export function renderTipMessage(
  template: string | null | undefined,
  handle: string,
  nearAccountId: string,
): string {
  return (template?.trim() || DEFAULT_TIP_MESSAGE_TEMPLATE)
    .replaceAll("{handle}", handle)
    .replaceAll("{account}", nearAccountId);
}

export function telegramShareUrl(message: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(message)}`;
}

export function createTelegramTipLookup(options: TelegramTipLookupOptions = {}): TelegramTipLookup {
  const baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const logger = options.logger ?? console;

  async function getJson(label: string, url: string): Promise<unknown> {
    const response = await doFetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    return await response.json();
  }

  async function fromBuilders(account: string): Promise<string | null> {
    const body = (await getJson(
      "builders API",
      `${baseUrl}/v1/builders/${encodeURIComponent(account)}`,
    )) as {
      links?: { telegram?: unknown };
      data?: { links?: { telegram?: unknown } };
    } | null;
    return normalizeTelegramHandle(body?.links?.telegram ?? body?.data?.links?.telegram);
  }

  async function fromNearSocial(account: string): Promise<string | null> {
    const keys = encodeURIComponent(`${account}/profile/**`);
    const body = (await getJson("NEAR Social", `${NEAR_SOCIAL_API}/get?keys=${keys}`)) as Record<
      string,
      { profile?: { linktree?: { telegram?: unknown } } } | undefined
    > | null;
    return normalizeTelegramHandle(body?.[account]?.profile?.linktree?.telegram);
  }

  async function resolveHandle(nearAccountId: string): Promise<TelegramHandleResult> {
    const account = nearAccountId.trim();
    const sources: Array<[TelegramHandleSource, (account: string) => Promise<string | null>]> = [];
    if (baseUrl) sources.push(["nearbuilders", fromBuilders]);
    sources.push(["near-social", fromNearSocial]);

    let anySucceeded = false;
    for (const [source, lookup] of sources) {
      try {
        const handle = await lookup(account);
        anySucceeded = true;
        if (handle) return { handle, source, available: true };
      } catch (error) {
        logger.warn(
          `[telegram] ${source} lookup for ${account} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return { handle: null, source: null, available: anySucceeded };
  }

  return {
    resolveHandle,
    getTip: async (nearAccountId) => {
      const resolved = await resolveHandle(nearAccountId);
      if (!resolved.handle) return { ...resolved, message: null, shareUrl: null };
      const message = renderTipMessage(options.messageTemplate, resolved.handle, nearAccountId);
      return { ...resolved, message, shareUrl: telegramShareUrl(message) };
    },
  };
}
