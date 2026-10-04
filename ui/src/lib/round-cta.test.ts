import { describe, expect, it } from "vitest";
import { type RoundCtaInput, roundCta, signInToJoinLink } from "./round-cta";

const base: RoundCtaInput = {
  roundId: "r1",
  canJoin: true,
  sessionPending: false,
  signedIn: true,
  nearAccountId: "alice.near",
  joined: false,
};

describe("roundCta", () => {
  it("sends an anonymous visitor through sign-in with the round URL preserved", () => {
    const cta = roundCta({ ...base, signedIn: false, nearAccountId: null });
    expect(cta).toEqual({
      kind: "signin",
      loginTo: { to: "/login", search: { redirect: "/feed/r1" } },
    });
  });

  it("keeps the join button for a signed-in builder with a linked NEAR account", () => {
    expect(roundCta(base)).toEqual({ kind: "join" });
  });

  it("keeps the leave button for a signed-in builder who already joined", () => {
    expect(roundCta({ ...base, joined: true })).toEqual({ kind: "leave" });
  });

  it("shows the join button while the session is still loading for a connected wallet", () => {
    expect(roundCta({ ...base, sessionPending: true })).toEqual({ kind: "join" });
  });

  it("routes a wallet-connected but signed-out visitor through sign-in", () => {
    const cta = roundCta({ ...base, signedIn: false });
    expect(cta).toEqual({
      kind: "signin",
      loginTo: { to: "/login", search: { redirect: "/feed/r1" } },
    });
  });

  it("waits for the session before choosing a sign-in or link-account CTA", () => {
    expect(roundCta({ ...base, sessionPending: true, nearAccountId: null })).toEqual({
      kind: "none",
    });
  });

  it("keeps the link-account CTA for a signed-in builder without a linked NEAR account", () => {
    expect(roundCta({ ...base, nearAccountId: null })).toEqual({ kind: "link-account" });
  });

  it("shows nothing when the round cannot be joined", () => {
    expect(roundCta({ ...base, canJoin: false })).toEqual({ kind: "none" });
  });

  it("shows nothing for an anonymous visitor on an unjoinable round", () => {
    expect(roundCta({ ...base, canJoin: false, signedIn: false, nearAccountId: null })).toEqual({
      kind: "none",
    });
  });
});

describe("signInToJoinLink", () => {
  it("points at /login with the round page as the redirect", () => {
    expect(signInToJoinLink("r2")).toEqual({
      to: "/login",
      search: { redirect: "/feed/r2" },
    });
  });
});
