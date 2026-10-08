import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Checkbox, Input } from "@/components";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/round-deadline";

export function RoundSettingsPanel({
  roundId,
  isPrivate,
  legionOnly,
  closesAt,
}: {
  roundId: string;
  isPrivate: boolean;
  legionOnly: boolean;
  closesAt: string | null;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [deadline, setDeadline] = useState(() => toDateTimeLocal(closesAt));
  const savedDeadline = toDateTimeLocal(closesAt);

  const settingsMutation = useMutation({
    mutationFn: (input: { isPrivate?: boolean; legionOnly?: boolean; closesAt?: string | null }) =>
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
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="setting-closes-at">
          Feedback deadline
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="setting-closes-at"
            type="datetime-local"
            className="w-auto"
            value={deadline}
            disabled={settingsMutation.isPending}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <Button
            size="sm"
            disabled={settingsMutation.isPending || !deadline || deadline === savedDeadline}
            onClick={() => settingsMutation.mutate({ closesAt: fromDateTimeLocal(deadline) })}
          >
            Save
          </Button>
          {closesAt && (
            <Button
              variant="ghost"
              size="sm"
              disabled={settingsMutation.isPending}
              onClick={() => {
                setDeadline("");
                settingsMutation.mutate({ closesAt: null });
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <span className="block text-xs text-muted-foreground">
          After this time (your local time) testers can't post or edit feedback. The round stays
          open until you close it and award credits.
        </span>
      </div>
    </Card>
  );
}
