import { describe, expect, it } from "vitest";
import { shouldUseAppShell } from "./app-shell";

describe("shouldUseAppShell", () => {
  it.each([
    "/rounds",
    "/projects/near-wallet/3",
    "/leaderboard",
    "/how-to-integrate",
    "/admin",
    "/dashboard",
    "/orgs",
  ])("gives signed-in users the app shell on %s", (path) => {
    expect(shouldUseAppShell(true, path)).toBe(true);
  });

  it.each([
    "/rounds",
    "/projects/near-wallet/3",
    "/leaderboard",
    "/how-to-integrate",
    "/admin",
  ])("gives anonymous visitors the marketing shell on %s", (path) => {
    expect(shouldUseAppShell(false, path)).toBe(false);
  });

  it("drops the shell for the compact pop-out workspace", () => {
    expect(shouldUseAppShell(true, "/testing/near-wallet/3", { compact: 1 })).toBe(false);
    expect(shouldUseAppShell(true, "/testing/near-wallet/3", { compact: "1" })).toBe(false);
    expect(shouldUseAppShell(true, "/testing/near-wallet/3", { compact: 0 })).toBe(true);
  });

  it("keeps the landing page and login on the marketing shell", () => {
    expect(shouldUseAppShell(true, "/")).toBe(false);
    expect(shouldUseAppShell(true, "/login")).toBe(false);
    expect(shouldUseAppShell(true, "/login/")).toBe(false);
  });
});
