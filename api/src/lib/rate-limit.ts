export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

export interface RateLimiter {
  /** Records a hit for `key`. Returns false once the key has used up its window. */
  allow(key: string): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5000,
  now = Date.now,
}: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    allow: (key) => {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((at) => at > current - windowMs);
      if (recent.length >= limit) {
        hits.delete(key);
        hits.set(key, recent);
        return false;
      }
      recent.push(current);
      hits.delete(key);
      hits.set(key, recent);
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return true;
    },
  };
}

export function clientKey(headers: Headers | undefined, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = headers?.get("cf-connecting-ip") ?? headers?.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? `ip:${ip}` : "ip:unknown";
}
