import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../../src/lib/rate-limit";
import { assertTesterKeyAllowed, TESTER_KEY_LIMIT } from "../../src/services/tester-key";

const limiter = () => createRateLimiter({ limit: TESTER_KEY_LIMIT, windowMs: 60_000 });
const personal = { apiKey: { id: "k1" }, user: { id: "u1" }, userId: "u1" };

describe("tester key guard (#298, #322)", () => {
  it("lets a session through without counting it", () => {
    const l = limiter();
    for (let i = 0; i < TESTER_KEY_LIMIT + 5; i++) {
      expect(() =>
        assertTesterKeyAllowed({ user: { id: "u1" }, userId: "u1" }, l, "post"),
      ).not.toThrow();
    }
  });

  it("lets a personal key that carries its owner's user through", () => {
    expect(() => assertTesterKeyAllowed(personal, limiter(), "join")).not.toThrow();
  });

  it("refuses an organization key and says it is an organization key", () => {
    try {
      assertTesterKeyAllowed(
        { apiKey: { id: "k2" }, principal: { type: "organization" } },
        limiter(),
        "join",
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({
        code: "UNAUTHORIZED",
        data: { keyKind: "organization" },
      });
    }
  });

  it("refuses a key the host attached no user to, and says so", () => {
    try {
      assertTesterKeyAllowed({ apiKey: { id: "k3" } }, limiter(), "post");
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ code: "UNAUTHORIZED", data: { keyKind: "no-user" } });
    }
  });

  it("rate limits a personal key per user and action", () => {
    const l = limiter();
    for (let i = 0; i < TESTER_KEY_LIMIT; i++) assertTesterKeyAllowed(personal, l, "post");
    expect(() => assertTesterKeyAllowed(personal, l, "post")).toThrow(/Too many requests/);
    expect(() => assertTesterKeyAllowed(personal, l, "join")).not.toThrow();
    expect(() =>
      assertTesterKeyAllowed({ ...personal, user: { id: "u2" }, userId: "u2" }, l, "post"),
    ).not.toThrow();
  });
});
