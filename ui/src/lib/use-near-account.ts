import { useQuery } from "@tanstack/react-query";
import type { ListAccountsResponseT } from "better-near-auth";
import { useSyncExternalStore } from "react";

import { sessionQueryOptions, useAuthClient } from "./auth";

const NEAR_ACCOUNTS_QUERY_KEY = ["near-accounts"] as const;
const NEAR_ACCOUNT_DETECT_QUERY_KEY = ["near-account-detect"] as const;

/**
 * The account the server knows about, mirroring better-near-auth's own session
 * restore: the active account first, then the primary, then the first listed.
 */
export function resolveListedNearAccount(
  response: ListAccountsResponseT | null | undefined,
): string | null {
  if (!response) return null;
  const account =
    response.activeAccount ?? response.accounts.find((a) => a.isPrimary) ?? response.accounts[0];
  return account?.accountId ?? null;
}

export function resolveListedNearAccountIds(
  response: ListAccountsResponseT | null | undefined,
): string[] {
  if (!response) return [];
  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(resolveListedNearAccount(response));
  add(response.activeAccount?.accountId);
  for (const account of response.accounts) add(account.accountId);
  return ids;
}

export function useNearAccountStatus(): {
  accountId: string | null;
  accountIds: string[];
  isDetecting: boolean;
} {
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearState = auth.$store.atoms.nearState;
  const state = useSyncExternalStore(
    nearState.subscribe,
    () => nearState.get(),
    () => null,
  );

  const fromStore = state?.accountId ?? null;

  // The server owns the linked-accounts list, so it answers on first load —
  // before any browser wallet has reconnected.
  const accountsQuery = useQuery({
    queryKey: NEAR_ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      try {
        const res = await auth.near.listAccounts();
        return res?.data ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!session?.user,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const listedIds = resolveListedNearAccountIds(accountsQuery.data);
  const accountId = fromStore ?? resolveListedNearAccount(accountsQuery.data);

  // The wallet probe only answers when a browser wallet is already connected,
  // so it runs last: once the server has said no linked account exists.
  const detectQuery = useQuery({
    queryKey: NEAR_ACCOUNT_DETECT_QUERY_KEY,
    queryFn: async () => {
      try {
        return await auth.near.detectNearAccount();
      } catch {
        return null;
      }
    },
    enabled: !accountId && (!session?.user || accountsQuery.isSuccess),
    staleTime: 60_000,
  });

  const detectedId = detectQuery.data?.accountId ?? null;
  const accountIds = [fromStore, ...listedIds, detectedId].filter(
    (id, index, all): id is string => !!id && all.indexOf(id) === index,
  );

  return {
    accountId: accountId ?? detectedId,
    accountIds,
    isDetecting:
      !accountId && ((!!session?.user && accountsQuery.isPending) || detectQuery.isFetching),
  };
}

export function useNearAccount(): string | null {
  return useNearAccountStatus().accountId;
}
