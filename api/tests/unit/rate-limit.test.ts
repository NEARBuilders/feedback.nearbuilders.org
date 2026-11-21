import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "../../src/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit and then refuses", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });
    expect([1, 2, 3, 4].map(() => limiter.allow("a"))).toEqual([true, true, true, false]);
  });

  it("tracks keys separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("b")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
  });

  it("allows again once the window has passed", () => {
    let clock = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => clock });
    expect(limiter.allow("a")).toBe(true);
    clock = 500;
    expect(limiter.allow("a")).toBe(false);
    clock = 1500;
    expect(limiter.allow("a")).toBe(true);
  });

  it("forgets the oldest keys past the cap", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => 0 });
    limiter.allow("a");
    limiter.allow("b");
    limiter.allow("c");
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefers the signed-in user", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1" }), "u1")).toBe("user:u1");
  });

  it("uses the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("ip:1.1.1.1");
  });

  it("prefers the Cloudflare header", () => {
    const headers = new Headers({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    expect(clientKey(headers)).toBe("ip:9.9.9.9");
  });

  it("falls back to a shared key with no address", () => {
    expect(clientKey(undefined)).toBe("ip:unknown");
  });
});
