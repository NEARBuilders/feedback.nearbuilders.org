/** Routes that always render the marketing shell, even for signed-in users. */
const MARKETING_ONLY_PATHS = new Set(["/", "/login"]);

export function isCompact(search: { compact?: unknown }): boolean {
  return search.compact === 1 || search.compact === "1" || search.compact === true;
}

export function shouldUseAppShell(
  isSignedIn: boolean,
  pathname: string,
  search: { compact?: unknown } = {},
): boolean {
  if (!isSignedIn || isCompact(search)) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return !MARKETING_ONLY_PATHS.has(normalized);
}
