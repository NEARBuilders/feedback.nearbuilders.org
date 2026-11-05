/** Splits the owner's pasted list (one account per line, commas also work) into ranked, unique ids. */
export function parseWinnersInput(text: string): string[] {
  const ids = text
    .split(/[\n,]/)
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(ids)];
}
