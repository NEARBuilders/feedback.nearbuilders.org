import { queryOptions } from "@tanstack/react-query";
import type { AuthClient } from "@/app";

export function nearProfileQueryOptions(authClient: AuthClient, accountId: string | null) {
  return queryOptions({
    queryKey: ["near-profile", accountId],
    queryFn: async () => {
      const { data } = await authClient.near.getProfile(accountId ?? undefined);
      return data ?? null;
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  });
}
