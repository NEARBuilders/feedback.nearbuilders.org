import { useQuery } from "@tanstack/react-query";
import { useRouteContext, useRouterState } from "@tanstack/react-router";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { shouldUseAppShell } from "@/lib/app-shell";

/** Single source of truth for whether the current page renders inside the app shell. */
export function useAppShellState() {
  const authClient = useAuthClient();
  const initialSession = useRouteContext({ strict: false, select: (c) => c.session });
  const location = useRouterState({ select: (s) => s.location });
  const { data: session } = useQuery(sessionQueryOptions(authClient, initialSession));

  return {
    session,
    useAppShell: shouldUseAppShell(!!session?.user, location.pathname, location.search),
  };
}
