const WORKSPACE_ROUTE_PREFIXES = ["/_authenticated", "/_admin"];

export interface ShellMatch {
  routeId: string;
  staticData?: { appShell?: boolean };
}

export function isCompact(search: { compact?: unknown }): boolean {
  return search.compact === 1 || search.compact === "1" || search.compact === true;
}

/** Folds the matched route chain into the sticky "user is in an app-shell session" state. */
export function nextAppShellSession(previous: boolean, matches: ShellMatch[]): boolean {
  const declared = matches.find((m) => typeof m.staticData?.appShell === "boolean");
  if (declared) return declared.staticData?.appShell === true;
  return (
    matches.some((m) =>
      WORKSPACE_ROUTE_PREFIXES.some((p) => m.routeId === p || m.routeId.startsWith(`${p}/`)),
    ) || previous
  );
}

export function shouldUseAppShell(
  isSignedIn: boolean,
  search: { compact?: unknown },
  appShellSession: boolean,
): boolean {
  if (!isSignedIn || isCompact(search)) return false;
  return appShellSession;
}
