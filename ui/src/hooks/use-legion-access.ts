import { useQuery } from "@tanstack/react-query";

import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { type LegionAccessResult, legionAccessQueryOptions } from "@/lib/queries/legion-access";

export type { LegionAccessResult };

export function useLegionAccess(enabled: boolean): {
  legionAccess: LegionAccessResult | undefined;
} {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const userId = session?.user?.id ?? null;
  const { data } = useQuery(legionAccessQueryOptions(apiClient, userId, enabled));
  return { legionAccess: data };
}
