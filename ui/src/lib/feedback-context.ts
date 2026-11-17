/**
 * Page details a tester can attach to written feedback (#299): where they were, which
 * browser and how big the window was. Everything is sanitized on the way in, the
 * address never carries a query string or hash (those can hold tokens), and the tester
 * can switch it off before sending.
 */
export interface FeedbackContext {
  pageUrl?: string;
  browser?: string;
  viewport?: string;
}

const MAX_URL_LENGTH = 300;
const MAX_BROWSER_LENGTH = 200;
// Printable ASCII only, and no backtick: the browser string is wrapped in an inline code span.
const NOT_PRINTABLE_OR_BACKTICK = /[^\x20-\x5f\x61-\x7e]/g;
const VIEWPORT = /^(\d{2,5})x(\d{2,5})$/;

export function sanitizePageUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const clean = `${url.origin}${url.pathname}`;
    return clean.length > MAX_URL_LENGTH ? undefined : clean;
  } catch {
    return undefined;
  }
}

export function sanitizeBrowser(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const clean = raw.replace(NOT_PRINTABLE_OR_BACKTICK, "").trim().slice(0, MAX_BROWSER_LENGTH);
  return clean || undefined;
}

/** Accepts "1440x900" and returns "1440 × 900". */
export function sanitizeViewport(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const match = VIEWPORT.exec(raw);
  return match ? `${match[1]} × ${match[2]}` : undefined;
}

export function hasContext(context: FeedbackContext | undefined): context is FeedbackContext {
  return !!context && !!(context.pageUrl || context.browser || context.viewport);
}

export function formatContextFooter(context: FeedbackContext): string {
  const lines: string[] = [];
  if (context.pageUrl) lines.push(`- Page: <${context.pageUrl}>`);
  if (context.browser) lines.push(`- Browser: \`${context.browser}\``);
  if (context.viewport) lines.push(`- Viewport: ${context.viewport}`);
  return lines.length ? `\n\n---\n\n**Page details**\n\n${lines.join("\n")}` : "";
}

/** The body with the details appended, or the body untouched when there is nothing to add. */
export function appendContext(body: string, context: FeedbackContext | undefined): string {
  return hasContext(context) ? body + formatContextFooter(context) : body;
}

/** The page the tester is on right now. Client only: returns nothing on the server. */
export function readLiveContext(): FeedbackContext {
  if (typeof window === "undefined") return {};
  return {
    pageUrl: sanitizePageUrl(window.location.href),
    browser: sanitizeBrowser(window.navigator.userAgent),
    viewport: sanitizeViewport(`${window.innerWidth}x${window.innerHeight}`),
  };
}

/** Details passed in the address by the embed launcher: the host page and its window size. */
export function contextFromSearch(search: { from?: string; vp?: string }): FeedbackContext {
  return { pageUrl: sanitizePageUrl(search.from), viewport: sanitizeViewport(search.vp) };
}

/** Adds this browser's user agent, which the launcher can't know for the tester. */
export function withBrowser(context: FeedbackContext): FeedbackContext {
  if (typeof window === "undefined") return context;
  return { ...context, browser: sanitizeBrowser(window.navigator.userAgent) };
}
