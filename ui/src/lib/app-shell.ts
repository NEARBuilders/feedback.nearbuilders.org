const APP_SHELL_PREFIXES = ["/dashboard", "/testing", "/manage", "/settings", "/orgs", "/admin"];

export function isCompact(search: { compact?: unknown }): boolean {
  return search.compact === 1 || search.compact === "1" || search.compact === true;
}

function isAppShellPath(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return APP_SHELL_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function shouldUseAppShell(
  isSignedIn: boolean,
  pathname: string,
  search: { compact?: unknown } = {},
): boolean {
  if (!isSignedIn || isCompact(search)) return false;
  return isAppShellPath(pathname);
}
