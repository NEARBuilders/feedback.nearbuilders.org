import { useQuery } from "@tanstack/react-query";
import { useMatches, useRouteContext, useRouterState } from "@tanstack/react-router";
import { createContext, useContext, useState } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { nextAppShellSession, type ShellMatch, shouldUseAppShell } from "@/lib/app-shell";

export const AppShellContext = createContext(false);

/** Single source of truth for whether the app shell wraps the page. Mounts once, at the root. */
export function useAppShellState() {
  const authClient = useAuthClient();
  const initialSession = useRouteContext({ strict: false, select: (c) => c.session });
  const { data: session } = useQuery(sessionQueryOptions(authClient, initialSession));

  const matches = useMatches();
  const search = useRouterState({ select: (s) => s.location.search });
  const shellMatches: ShellMatch[] = matches.map((m) => ({
    routeId: m.routeId,
    staticData: m.staticData,
  }));

  const [appShellSession, setAppShellSession] = useState(false);
  const next = nextAppShellSession(appShellSession, shellMatches);
  if (next !== appShellSession) setAppShellSession(next);

  return {
    session,
    useAppShell: shouldUseAppShell(!!session?.user, search, appShellSession),
  };
}

/** Read-only projection for descendants: am I inside the app shell? */
export function useInAppShell(): boolean {
  return useContext(AppShellContext);
}
