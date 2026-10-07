import type { FeedbackStatus } from "@/lib/queries/feedback";

export type InboxKeyAction =
  | { type: "open"; id: string }
  | { type: "status"; id: string; status: FeedbackStatus };

const STEPS: Record<string, number> = { j: 1, k: -1 };
const STATUSES: Record<string, FeedbackStatus> = { r: "resolved", d: "dismissed" };

export function inboxKeyAction(
  key: string,
  ids: string[],
  openId: string | undefined,
): InboxKeyAction | null {
  const step = STEPS[key];
  if (step !== undefined) {
    const index = openId ? ids.indexOf(openId) + step : 0;
    const id = ids[Math.max(index, 0)];
    return id && id !== openId ? { type: "open", id } : null;
  }
  const status = STATUSES[key];
  return status && openId ? { type: "status", id: openId, status } : null;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
