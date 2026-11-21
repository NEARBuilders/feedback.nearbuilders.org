interface OutboxRowShape {
  operation: "emit" | "retract";
  eventType: string | null;
  actor: string | null;
  attempts: number;
  lastError: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  "round.closed": "Round closed",
  "credit.awarded": "Credit awarded",
  "feedback.accepted": "Feedback accepted",
  "feedback.posted": "Feedback posted",
};

export function describeOutboxEvent(
  row: Pick<OutboxRowShape, "operation" | "eventType" | "actor">,
): string {
  if (row.operation === "retract") return "Retract an earlier event";
  if (!row.eventType) return "Activity event";
  return EVENT_LABELS[row.eventType] ?? row.eventType;
}

export function describeFailure(row: OutboxRowShape): string {
  const tries = `${row.attempts} ${row.attempts === 1 ? "try" : "tries"}`;
  const reason = row.lastError?.trim();
  return reason ? `${tries}. ${reason}` : tries;
}

export function summariseFailed(rows: Array<{ eventType: string | null; operation: string }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.operation === "retract" ? "retract" : (row.eventType ?? "event");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}
