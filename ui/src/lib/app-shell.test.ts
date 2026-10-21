import { describe, expect, it } from "vitest";
import { shouldUseAppShell } from "./app-shell";

describe("shouldUseAppShell", () => {
  it.each([
    "/dashboard",
    "/dashboard/",
    "/testing",
    "/manage",
    "/manage/new",
    "/settings",
    "/settings/profile",
    "/orgs",
    "/orgs/acme",
    "/admin",
  ])("gives signed-in users the app shell on %s", (path) => {
    expect(shouldUseAppShell(true, path)).toBe(true);
  });

  it.each([
    "/",
    "/login",
    "/login/",
    "/rounds",
    "/projects",
    "/projects/near-wallet/3",
    "/leaderboard",
    "/how-to-integrate",
  ])("keeps signed-in users on the marketing shell on %s", (path) => {
    expect(shouldUseAppShell(true, path)).toBe(false);
  });

  it.each([
    "/rounds",
    "/projects",
    "/leaderboard",
    "/how-to-integrate",
  ])("keeps the app shell on %s after visiting the workspace", (path) => {
    expect(shouldUseAppShell(true, path, {}, { stayInAppShell: true })).toBe(true);
  });

  it("drops stay-in-shell on the home page", () => {
    expect(shouldUseAppShell(true, "/", {}, { stayInAppShell: true })).toBe(false);
  });

  it.each([
    "/rounds",
    "/projects/near-wallet/3",
    "/leaderboard",
    "/how-to-integrate",
    "/admin",
    "/dashboard",
  ])("gives anonymous visitors the marketing shell on %s", (path) => {
    expect(shouldUseAppShell(false, path)).toBe(false);
  });

  it("drops the shell for the compact pop-out workspace", () => {
    expect(shouldUseAppShell(true, "/dashboard", { compact: 1 })).toBe(false);
    expect(shouldUseAppShell(true, "/dashboard", { compact: "1" })).toBe(false);
    expect(
      shouldUseAppShell(
        true,
        "/projects/near-wallet/3/submit",
        { compact: 0 },
        { stayInAppShell: true },
      ),
    ).toBe(true);
  });
});
