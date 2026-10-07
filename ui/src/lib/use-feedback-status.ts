import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { type FeedbackStatus, invalidateFeedbackQueries } from "@/lib/queries/feedback";

export function useSetFeedbackStatus(roundId: string) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedbackIds: string[]; status: FeedbackStatus; note?: string }) =>
      apiClient.setFeedbackStatus({ id: roundId, ...input }),
    onSuccess: (updated, { status }) => {
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.success(
        updated.length === 1 ? `Marked ${status}` : `Marked ${updated.length} items ${status}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSetFeedbackStarred(roundId: string) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedbackIds: string[]; starred: boolean }) =>
      apiClient.setFeedbackStarred({ id: roundId, ...input }),
    onSuccess: (updated, { starred }) => {
      void invalidateFeedbackQueries(queryClient, roundId);
      toast.success(
        updated.length === 1
          ? starred
            ? "Starred"
            : "Star removed"
          : `${starred ? "Starred" : "Unstarred"} ${updated.length} items`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
