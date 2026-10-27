import { useQuery } from "@tanstack/react-query";
import { useRouteContext, useRouterState } from "@tanstack/react-router";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { isMarketingHomePath, isWorkspacePath, shouldUseAppShell } from "@/lib/app-shell";

let stayInAppShell = false;

/** Single source of truth for whether the current page renders inside the app shell. */
export function useAppShellState() {
  const authClient = useAuthClient();
  const initialSession = useRouteContext({ strict: false, select: (c) => c.session });
  const location = useRouterState({ select: (s) => s.location });
  const { data: session } = useQuery(sessionQueryOptions(authClient, initialSession));

  if (isWorkspacePath(location.pathname)) stayInAppShell = true;
  else if (isMarketingHomePath(location.pathname)) stayInAppShell = false;

  return {
    session,
    useAppShell: shouldUseAppShell(!!session?.user, location.pathname, location.search, {
      stayInAppShell,
    }),
  };
}
