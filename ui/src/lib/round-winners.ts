const ROUND_WINNERS: Record<string, readonly string[]> = {
  "nearly-trade/1": [
    "m1halich228.tg",
    "sergeserge1.tg",
    "bassoman.tg",
    "pn193014.tg",
    "maiye.near",
    "marian_h1.tg",
    "danseyka.tg",
    "gaaraji.near",
    "oscoi.near",
    "7178321377-hot.tg",
  ],
};

export function getRoundWinners(
  projectSlug: string,
  projectRoundNumber: number,
): readonly string[] {
  return ROUND_WINNERS[`${projectSlug}/${projectRoundNumber}`] ?? [];
}

const ROUND_OVERVIEW_PATH = /^\/projects\/([^/]+)\/(\d+)\/?$/;

export function getWinnersForPath(pathname: string): readonly string[] {
  const match = ROUND_OVERVIEW_PATH.exec(pathname);
  if (!match) return [];
  return getRoundWinners(decodeURIComponent(match[1] ?? ""), Number(match[2]));
}
