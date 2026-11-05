const ROUND_OVERVIEW_PATH = /^\/projects\/([^/]+)\/(\d+)\/?$/;

/** The project slug and round number when `pathname` is a round's overview page, else null. */
export function parseRoundOverviewPath(pathname: string): { slug: string; number: number } | null {
  const match = ROUND_OVERVIEW_PATH.exec(pathname);
  if (!match) return null;
  return { slug: decodeURIComponent(match[1] ?? ""), number: Number(match[2]) };
}

/** Splits the owner's pasted list (one account per line, commas also work) into ranked, unique ids. */
export function parseWinnersInput(text: string): string[] {
  const ids = text
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);
  return [...new Set(ids)];
}
