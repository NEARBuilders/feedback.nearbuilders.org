import { describe, expect, it } from "vitest";
import { filterSidebarByRole, NAV_ITEMS } from "./nav-items";

describe("dashboard navigation", () => {
  it("shows the feed, how-it-works, and request-a-round links to everyone in the shell", () => {
    const anonymousPaths = filterSidebarByRole(NAV_ITEMS, "anon").map((item) => item.to);

    expect(anonymousPaths).toEqual(
      expect.arrayContaining(["/feed", "/feed/request", "/how-to-integrate"]),
    );
  });

  it("shows admin to admins only", () => {
    const memberPaths = filterSidebarByRole(NAV_ITEMS, "member").map((item) => item.to);
    const adminPaths = filterSidebarByRole(NAV_ITEMS, "admin").map((item) => item.to);

    expect(memberPaths).not.toContain("/admin");
    expect(adminPaths).toContain("/admin");
  });
});
