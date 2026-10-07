export type BroadcastKind = "round_opened" | "round_closing" | "custom";

export type FeedbackStatusKind = "feedback_resolved" | "feedback_dismissed";

export type NotificationKind = BroadcastKind | FeedbackStatusKind | "round_closed";

export interface NotificationText {
  title: string;
  body: string;
}

const DEFAULT_BODY: Record<Exclude<NotificationKind, "custom">, string> = {
  round_opened: "The round is open. Join in and share your feedback.",
  round_closing: "This round is closing soon. Post any feedback you still have.",
  round_closed: "This round has closed. Thanks for testing.",
  feedback_resolved: "The round owner resolved your feedback. Thanks for testing.",
  feedback_dismissed: "The round owner dismissed your feedback. Open it to reply.",
};

export function notificationText(
  kind: NotificationKind,
  roundTitle: string,
  message?: string | null,
): NotificationText {
  const note = message?.trim() ?? "";
  switch (kind) {
    case "round_opened":
      return { title: `Round opened: ${roundTitle}`, body: note || DEFAULT_BODY.round_opened };
    case "round_closing":
      return { title: `Closing soon: ${roundTitle}`, body: note || DEFAULT_BODY.round_closing };
    case "round_closed":
      return { title: `Round closed: ${roundTitle}`, body: note || DEFAULT_BODY.round_closed };
    case "custom":
      return { title: `Update on ${roundTitle}`, body: note };
    case "feedback_resolved":
      return { title: `Feedback resolved: ${roundTitle}`, body: note || DEFAULT_BODY[kind] };
    case "feedback_dismissed":
      return { title: `Feedback dismissed: ${roundTitle}`, body: note || DEFAULT_BODY[kind] };
  }
}
