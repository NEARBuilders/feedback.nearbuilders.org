import type { QueryClient } from "@tanstack/react-query";
import { feedbackKeys } from "@/lib/queries/feedback";
import { participationKeys } from "@/lib/queries/participation";
import { projectKeys } from "@/lib/queries/projects";
import { roundKeys } from "@/lib/queries/rounds";

export function resetViewerQueries(queryClient: QueryClient) {
  for (const queryKey of [
    roundKeys.all,
    projectKeys.all,
    participationKeys.all,
    feedbackKeys.all,
  ]) {
    queryClient.removeQueries({ queryKey });
  }
}
