import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card, Field, FieldLabel, Textarea } from "@/components";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SegmentedToggle } from "@/components/segmented-toggle";
import {
  BROADCAST_MESSAGE_MAX,
  BROADCAST_PRESETS,
  type BroadcastKind,
  broadcastConfirmation,
  canSendBroadcast,
} from "@/lib/notifications";

interface BroadcastPanelProps {
  roundId: string;
  participantCount: number;
}

export function BroadcastPanel({ roundId, participantCount }: BroadcastPanelProps) {
  const apiClient = useApiClient();
  const [kind, setKind] = useState<BroadcastKind>("custom");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const preset = BROADCAST_PRESETS.find((entry) => entry.value === kind);
  const canSend = canSendBroadcast(kind, message, participantCount);

  const sendMutation = useMutation({
    mutationFn: () =>
      apiClient.broadcastToRound({
        id: roundId,
        kind,
        message: message.trim() || undefined,
      }),
    onSuccess: ({ recipients }) => {
      setMessage("");
      setConfirming(false);
      toast.success(`Sent to ${recipients} ${recipients === 1 ? "participant" : "participants"}`);
    },
    onError: (err: Error) => {
      setConfirming(false);
      toast.error(err.message);
    },
  });

  return (
    <Card className="p-4 space-y-3 border-t border-border" data-testid="broadcast-panel">
      <span className="text-sm font-medium text-foreground">Message participants</span>
      {participantCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody has joined yet. Broadcasts go to everyone in the round once testers join.
        </p>
      ) : (
        <>
          <SegmentedToggle
            value={kind}
            onValueChange={setKind}
            options={BROADCAST_PRESETS.map(({ value, label }) => ({ value, label }))}
            ariaLabel="Broadcast type"
          />
          {preset && <p className="text-xs text-muted-foreground">{preset.hint}</p>}
          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor="broadcast-message">
                message{kind === "custom" ? "" : " (optional)"}
              </FieldLabel>
              <span className="text-xs text-muted-foreground">
                {message.length}/{BROADCAST_MESSAGE_MAX}
              </span>
            </div>
            <Textarea
              id="broadcast-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={BROADCAST_MESSAGE_MAX}
              placeholder="What should testers know?"
              disabled={sendMutation.isPending}
            />
          </Field>
          <Button onClick={() => setConfirming(true)} disabled={!canSend || sendMutation.isPending}>
            Send to {participantCount} {participantCount === 1 ? "participant" : "participants"}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Send this broadcast?"
        description={broadcastConfirmation(participantCount)}
        confirmLabel="Send"
        isPending={sendMutation.isPending}
        onConfirm={() => sendMutation.mutate()}
      />
    </Card>
  );
}
