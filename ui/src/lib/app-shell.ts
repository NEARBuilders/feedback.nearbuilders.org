const APP_SHELL_PREFIXES = ["/dashboard", "/testing", "/manage", "/settings", "/orgs", "/admin"];
const PUBLIC_BROWSE_PREFIXES = ["/rounds", "/projects", "/leaderboard", "/how-to-integrate"];
const MARKETING_HOME_PATHS = new Set(["/", "/login"]);

export function isCompact(search: { compact?: unknown }): boolean {
  return search.compact === 1 || search.compact === "1" || search.compact === true;
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  const normalized = normalizePath(pathname);
  return prefixes.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

export function isWorkspacePath(pathname: string): boolean {
  return matchesPrefix(pathname, APP_SHELL_PREFIXES);
}

export function isMarketingHomePath(pathname: string): boolean {
  return MARKETING_HOME_PATHS.has(normalizePath(pathname));
}

export function isPublicBrowsePath(pathname: string): boolean {
  return matchesPrefix(pathname, PUBLIC_BROWSE_PREFIXES);
}

export function shouldUseAppShell(
  isSignedIn: boolean,
  pathname: string,
  search: { compact?: unknown } = {},
  options: { stayInAppShell?: boolean } = {},
): boolean {
  if (!isSignedIn || isCompact(search)) return false;
  if (isWorkspacePath(pathname)) return true;
  if (options.stayInAppShell && isPublicBrowsePath(pathname)) return true;
  return false;
}
