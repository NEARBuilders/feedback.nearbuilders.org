import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { getNearAccountId, sessionQueryOptions, useAuthClient } from "./auth";

const NEAR_ACCOUNT_DETECT_QUERY_KEY = ["near-account-detect"] as const;

export function useNearAccountStatus(): { accountId: string | null; isDetecting: boolean } {
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearState = auth.$store.atoms.nearState;
  const state = useSyncExternalStore(
    nearState.subscribe,
    () => nearState.get(),
    () => null,
  );
  const user = session?.user as
    | {
        accounts?: Array<{ providerId?: unknown; accountId?: unknown; network?: unknown }>;
      }
    | undefined;

  const fromStore = state?.accountId ?? getNearAccountId(user?.accounts ?? []);

  const detectQuery = useQuery({
    queryKey: NEAR_ACCOUNT_DETECT_QUERY_KEY,
    queryFn: async () => {
      try {
        return await auth.near.detectNearAccount();
      } catch {
        return null;
      }
    },
    enabled: !fromStore,
    staleTime: 60 * 1000,
  });

  return {
    accountId: fromStore ?? detectQuery.data?.accountId ?? null,
    isDetecting: !fromStore && detectQuery.isFetching,
  };
}

export function useNearAccount(): string | null {
  return useNearAccountStatus().accountId;
}
