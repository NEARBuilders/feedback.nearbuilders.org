/** What to show for a feedback item's author: anonymous submissions have no account (#89). */
export const ANONYMOUS_LABEL = "Anonymous";

export function authorLabel(entry: { authorAccountId: string | null }): string {
  return entry.authorAccountId ?? ANONYMOUS_LABEL;
}
