/** Routes that always render the marketing shell, even for signed-in users. */
const MARKETING_ONLY_PATHS = new Set(["/", "/login"]);

export function shouldUseAppShell(isSignedIn: boolean, pathname: string): boolean {
  if (!isSignedIn) return false;
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return !MARKETING_ONLY_PATHS.has(normalized);
}
