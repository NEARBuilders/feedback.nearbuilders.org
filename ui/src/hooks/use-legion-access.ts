import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "@/app";
import { type LegionAccessResult, legionAccessQueryOptions } from "@/lib/queries/legion-access";

export type { LegionAccessResult };

export function useLegionAccess(): {
  legionAccess: LegionAccessResult | undefined;
  isLoading: boolean;
} {
  const apiClient = useApiClient();
  const { data, isLoading } = useQuery(legionAccessQueryOptions(apiClient));
  return { legionAccess: data, isLoading };
}
