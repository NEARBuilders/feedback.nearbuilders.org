import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { invalidateParticipationQueries } from "@/lib/queries/participation";
import { invalidateRoundQueries } from "@/lib/queries/rounds";

/**
 * Join/leave for any round surface (round page, rounds table). Refreshes the
 * round and participation caches exactly like the round page used to.
 */
export function useRoundJoinMutation() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roundId, join }: { roundId: string; join: boolean }) =>
      join ? apiClient.joinRound({ id: roundId }) : apiClient.leaveRound({ id: roundId }),
    onSuccess: (_detail, { join }) => {
      void invalidateRoundQueries(queryClient);
      void invalidateParticipationQueries(queryClient);
      toast.success(join ? "Joined the round" : "Left the round");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
