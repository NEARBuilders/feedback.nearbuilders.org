import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "@/app";

export const teamKeys = {
  org: (orgId: string) => ["org-teams", orgId] as const,
};

export function orgTeamsQueryOptions(apiClient: ApiClient, orgId: string) {
  return queryOptions({
    queryKey: teamKeys.org(orgId),
    queryFn: () => apiClient.auth.listTeams({ organizationId: orgId }),
    enabled: !!orgId,
    retry: false,
  });
}
