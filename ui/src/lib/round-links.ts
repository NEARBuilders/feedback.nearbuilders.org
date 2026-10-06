export interface RoundRef {
  projectSlug: string;
  projectRoundNumber: number;
}

export interface RoundParams {
  slug: string;
  n: string;
}

export function roundParams(round: RoundRef): RoundParams {
  return { slug: round.projectSlug, n: String(round.projectRoundNumber) };
}

export function roundHref(round: RoundRef): string {
  return `/projects/${encodeURIComponent(round.projectSlug)}/${round.projectRoundNumber}`;
}

export function parseRoundNumber(value: string): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
