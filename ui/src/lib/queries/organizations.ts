import { queryOptions } from "@tanstack/react-query";
import type { AuthClient, Organization } from "@/lib/auth";

export const organizationsKeys = {
  all: ["organizations"] as const,
};

/**
 * The organizations the signed-in user belongs to. A failed fetch must throw,
 * never collapse to an empty list — an empty success used to cache as "this
 * user is in no organizations" and rendered "Organization not found" on every
 * org page until the stale window expired.
 */
export function organizationsQueryOptions(authClient: AuthClient) {
  return queryOptions({
    queryKey: organizationsKeys.all,
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await authClient.organization.list();
      if (error) throw new Error(error.message);
      return (data ?? []) as Organization[];
    },
    staleTime: 30 * 1000,
  });
}
