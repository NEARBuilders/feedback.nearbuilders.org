import { FEEDBACK_TEXT_MAX, feedbackTextLength, hasUnuploadedImage } from "./feedback-body";

export function roundFeedbackPermissions(status: string, isExpired: boolean) {
  const canDelete = status === "open";
  return { canEdit: canDelete && !isExpired, canDelete };
}

export function isOwnFeedback(authorAccountId: string, currentAccountIds: string[]): boolean {
  return currentAccountIds.includes(authorAccountId);
}

export function canSaveFeedbackEdit(input: {
  draft: string;
  format: string;
  pendingUploads: number;
  isPending: boolean;
}): boolean {
  if (input.isPending || input.pendingUploads > 0) return false;
  if (!input.draft.trim()) return false;
  if (input.format !== "written") return true;
  return feedbackTextLength(input.draft) <= FEEDBACK_TEXT_MAX && !hasUnuploadedImage(input.draft);
}
