/** A round that can still take feedback: open, and not past its optional deadline. */
export function acceptsFeedback(
  round: { status: string; closesAt: string | null },
  now: Date = new Date(),
): boolean {
  if (round.status !== "open") return false;
  return !round.closesAt || new Date(round.closesAt).getTime() > now.getTime();
}

/** ISO instant -> the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in local time. */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value (local time) -> an ISO instant, or undefined when blank/invalid. */
export function fromDateTimeLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
