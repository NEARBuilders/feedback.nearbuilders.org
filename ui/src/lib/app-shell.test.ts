import { describe, expect, it } from "vitest";
import { nextAppShellSession, type ShellMatch, shouldUseAppShell } from "./app-shell";

const to = (...routeIds: string[]): ShellMatch[] => routeIds.map((routeId) => ({ routeId }));

describe("nextAppShellSession", () => {
  it("enters the app shell session on workspace routes", () => {
    for (const matches of [
      to("/_authenticated", "/_authenticated/_dashboard", "/_authenticated/_dashboard/dashboard/"),
      to("/_authenticated/_dashboard/settings/profile"),
      to("/_authenticated/_dashboard/orgs/acme"),
      to("/_authenticated/_dashboard/manage/near-wallet/3/feedback/42"),
      to("/_admin", "/_admin/_dashboard/admin"),
    ]) {
      expect(nextAppShellSession(false, matches)).toBe(true);
    }
  });

  it("resets the session on routes declaring appShell: false", () => {
    expect(
      nextAppShellSession(true, [
        { routeId: "/_public" },
        { routeId: "/_public/", staticData: { appShell: false } },
      ]),
    ).toBe(false);
    expect(
      nextAppShellSession(true, [
        { routeId: "/_public" },
        { routeId: "/_public/login", staticData: { appShell: false } },
      ]),
    ).toBe(false);
  });

  it("carries the session on undeclared public routes", () => {
    expect(nextAppShellSession(true, to("/_public", "/_public/rounds/"))).toBe(true);
    expect(nextAppShellSession(true, to("/_public", "/_public/projects/near-wallet/3"))).toBe(true);
    expect(nextAppShellSession(true, to("/_public", "/_public/feed/$roundId"))).toBe(true);
    expect(nextAppShellSession(true, to("/_public", "/_public/$accountId/"))).toBe(true);
  });

  it("stays out of the session when nothing was declared or matched", () => {
    expect(nextAppShellSession(false, to("/_public", "/_public/rounds/"))).toBe(false);
  });

  it("lets a route declaration win over branch structure", () => {
    expect(
      nextAppShellSession(true, [
        { routeId: "/_authenticated/_dashboard/dashboard/", staticData: { appShell: false } },
      ]),
    ).toBe(false);
  });
});

describe("shouldUseAppShell", () => {
  it("requires a signed-in session", () => {
    expect(shouldUseAppShell(false, {}, true)).toBe(false);
  });

  it("drops the shell for the compact pop-out", () => {
    expect(shouldUseAppShell(true, { compact: 1 }, true)).toBe(false);
    expect(shouldUseAppShell(true, { compact: "1" }, true)).toBe(false);
    expect(shouldUseAppShell(true, { compact: 0 }, true)).toBe(true);
  });

  it("follows the app shell session otherwise", () => {
    expect(shouldUseAppShell(true, {}, true)).toBe(true);
    expect(shouldUseAppShell(true, {}, false)).toBe(false);
  });
});
