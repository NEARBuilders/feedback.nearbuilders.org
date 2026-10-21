import { useQuery } from "@tanstack/react-query";
import { useRouteContext, useRouterState } from "@tanstack/react-router";
import { useRef } from "react";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { isMarketingHomePath, isWorkspacePath, shouldUseAppShell } from "@/lib/app-shell";

/** Single source of truth for whether the current page renders inside the app shell. */
export function useAppShellState() {
  const authClient = useAuthClient();
  const initialSession = useRouteContext({ strict: false, select: (c) => c.session });
  const location = useRouterState({ select: (s) => s.location });
  const { data: session } = useQuery(sessionQueryOptions(authClient, initialSession));
  const stayInAppShell = useRef(false);

  if (isWorkspacePath(location.pathname)) stayInAppShell.current = true;
  else if (isMarketingHomePath(location.pathname)) stayInAppShell.current = false;

  return {
    session,
    useAppShell: shouldUseAppShell(!!session?.user, location.pathname, location.search, {
      stayInAppShell: stayInAppShell.current,
    }),
  };
}
