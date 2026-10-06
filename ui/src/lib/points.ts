export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? "point" : "points"}`;
}

export function acceptedLabel(count: number): string {
  return `${count} accepted`;
}

export function acceptanceRate(acceptedCount: number, submittedCount: number): string {
  if (submittedCount <= 0) return "—";
  return `${Math.round((acceptedCount / submittedCount) * 100)}%`;
}
