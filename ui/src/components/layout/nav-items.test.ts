import { describe, expect, it } from "vitest";
import { shouldUseAppShell } from "../../lib/app-shell";
import { filterSidebarByRole, getActiveItem, groupSidebarItems, NAV_ITEMS } from "./nav-items";

describe("dashboard navigation", () => {
  it("shows the feed and how-it-works links to everyone", () => {
    const anonymousPaths = filterSidebarByRole(NAV_ITEMS, "anon").map((item) => item.to);

    expect(anonymousPaths).toEqual(expect.arrayContaining(["/feed", "/how-to-integrate"]));
    expect(anonymousPaths).not.toContain("/admin");
  });

  it("shows workspace links to signed-in members", () => {
    const memberPaths = filterSidebarByRole(NAV_ITEMS, "member").map((item) => item.to);

    expect(memberPaths).toEqual(
      expect.arrayContaining(["/dashboard", "/feed/request", "/orgs", "/feed"]),
    );
  });

  it("shows admin to admins only", () => {
    const memberPaths = filterSidebarByRole(NAV_ITEMS, "member").map((item) => item.to);
    const adminPaths = filterSidebarByRole(NAV_ITEMS, "admin").map((item) => item.to);

    expect(memberPaths).not.toContain("/admin");
    expect(adminPaths).toContain("/admin");
  });

  it("groups items into labeled sections and hides empty ones", () => {
    const member = groupSidebarItems(filterSidebarByRole(NAV_ITEMS, "member"));
    const admin = groupSidebarItems(filterSidebarByRole(NAV_ITEMS, "admin"));

    expect(member.map((section) => section.id)).toEqual(["main", "workspace"]);
    expect(admin.map((section) => section.id)).toEqual(["main", "workspace", "manage"]);
    expect(admin.every((section) => section.label && section.items.length > 0)).toBe(true);
  });

  it("highlights the feed on round detail pages but not on request a round", () => {
    expect(getActiveItem(NAV_ITEMS, "/feed")?.label).toBe("feed");
    expect(getActiveItem(NAV_ITEMS, "/feed/round_1")?.label).toBe("feed");
    expect(getActiveItem(NAV_ITEMS, "/feed/request")?.label).toBe("request a round");
    expect(getActiveItem(NAV_ITEMS, "/orgs/acme")?.label).toBe("orgs");
    expect(getActiveItem(NAV_ITEMS, "/settings/profile")).toBeUndefined();
  });

  it("only links to pages that render inside the shell", () => {
    for (const item of NAV_ITEMS) {
      expect(shouldUseAppShell(true, item.to), item.to).toBe(true);
    }
  });
});
