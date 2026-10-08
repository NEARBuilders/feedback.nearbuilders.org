export type BroadcastKind = "round_opened" | "round_closing" | "custom";

export const BROADCAST_PRESETS: Array<{ value: BroadcastKind; label: string; hint: string }> = [
  {
    value: "round_opened",
    label: "Round opened",
    hint: "Tell testers the round is open. A default message is used unless you add one.",
  },
  {
    value: "round_closing",
    label: "Closing soon",
    hint: "Remind testers to post their feedback. A default message is used unless you add one.",
  },
  {
    value: "custom",
    label: "Custom note",
    hint: "Send your own message to everyone in the round.",
  },
];

export const BROADCAST_MESSAGE_MAX = 1000;

export function formatUnreadCount(count: number): string {
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function canSendBroadcast(
  kind: BroadcastKind,
  message: string,
  participantCount: number,
): boolean {
  if (participantCount <= 0) return false;
  if (message.length > BROADCAST_MESSAGE_MAX) return false;
  return kind !== "custom" || message.trim().length > 0;
}

export function broadcastConfirmation(participantCount: number): string {
  return `This sends a notification to ${participantCount} ${
    participantCount === 1 ? "participant" : "participants"
  }. It can't be unsent.`;
}

export function notificationTarget(kind: string) {
  return kind.startsWith("feedback_")
    ? ("/projects/$slug/$n/submit" as const)
    : ("/projects/$slug/$n" as const);
}
