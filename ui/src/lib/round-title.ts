const LEADING_HASH_NUMBER = /^#\s*\d+\b/;

export function roundListTitle(
  title: string,
  projectRoundNumber: number,
): { prefix: string | null; label: string } {
  if (LEADING_HASH_NUMBER.test(title.trim())) {
    return { prefix: null, label: title };
  }
  return { prefix: `#${projectRoundNumber}`, label: title };
}

export function formatRoundListTitle(title: string, projectRoundNumber: number): string {
  const { prefix, label } = roundListTitle(title, projectRoundNumber);
  return prefix ? `${prefix} ${label}` : label;
}
