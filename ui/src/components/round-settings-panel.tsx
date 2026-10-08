import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Card, Checkbox, DateTimePicker } from "@/components";
import { invalidateRoundQueries } from "@/lib/queries/rounds";

export function RoundSettingsPanel({
  roundId,
  isPrivate,
  legionOnly,
  endsAt,
}: {
  roundId: string;
  isPrivate: boolean;
  legionOnly: boolean;
  endsAt: string | null;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const settingsMutation = useMutation({
    mutationFn: (input: { isPrivate?: boolean; legionOnly?: boolean; endsAt?: string | null }) =>
      apiClient.updateRoundSettings({ id: roundId, ...input }),
    onSuccess: () => {
      void invalidateRoundQueries(queryClient);
      toast.success("Round settings updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <span className="text-sm font-medium text-foreground">Round access</span>
      <label className="flex cursor-pointer items-start gap-2.5" htmlFor="setting-private">
        <Checkbox
          id="setting-private"
          checked={isPrivate}
          disabled={settingsMutation.isPending}
          onCheckedChange={(checked) => settingsMutation.mutate({ isPrivate: checked === true })}
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">Private feedback</span>
          <span className="block text-xs text-muted-foreground">
            Only your organization, platform admins and each author can read submissions. Comments
            already published to Nostr can't be taken back.
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2.5" htmlFor="setting-legion">
        <Checkbox
          id="setting-legion"
          checked={legionOnly}
          disabled={settingsMutation.isPending}
          onCheckedChange={(checked) => settingsMutation.mutate({ legionOnly: checked === true })}
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">Legion members only</span>
          <span className="block text-xs text-muted-foreground">
            Only holders of a Legion SBT can join and post.
          </span>
        </span>
      </label>
      <div className="flex items-start gap-2.5">
        <DateTimePicker
          value={endsAt}
          disabled={settingsMutation.isPending}
          placeholder="No expiration"
          onChange={(value) => settingsMutation.mutate({ endsAt: value })}
        />
        <span className="text-sm">
          <span className="font-medium text-foreground">Closes at</span>
          <span className="block text-xs text-muted-foreground">
            Once this passes, testers can't join or post. Clear it to keep the round open
            indefinitely.
          </span>
        </span>
      </div>
    </Card>
  );
}
