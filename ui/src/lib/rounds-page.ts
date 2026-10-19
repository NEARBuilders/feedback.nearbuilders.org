export const ROUNDS_PAGE_SIZE = 10;

export function clampRoundsPage(itemCount: number, page: number, pageSize = ROUNDS_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(itemCount / pageSize));
  return Math.min(Math.max(1, page), pageCount);
}
