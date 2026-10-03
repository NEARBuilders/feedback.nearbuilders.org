import { describe, expect, it } from "vitest";
import { shouldUseAppShell } from "./app-shell";

describe("shouldUseAppShell", () => {
  it.each([
    "/feed",
    "/feed/round_1",
    "/how-to-integrate",
    "/admin",
    "/dashboard",
    "/orgs",
  ])("gives signed-in users the app shell on %s", (path) => {
    expect(shouldUseAppShell(true, path)).toBe(true);
  });

  it.each([
    "/feed",
    "/feed/round_1",
    "/how-to-integrate",
    "/admin",
  ])("gives anonymous visitors the marketing shell on %s", (path) => {
    expect(shouldUseAppShell(false, path)).toBe(false);
  });

  it("keeps the landing page and login on the marketing shell", () => {
    expect(shouldUseAppShell(true, "/")).toBe(false);
    expect(shouldUseAppShell(true, "/login")).toBe(false);
    expect(shouldUseAppShell(true, "/login/")).toBe(false);
  });
});
