import { describe, expect, it } from "vitest";
import { shouldUseAppShell } from "../../lib/app-shell";
import { filterSidebarByRole, getActiveItem, groupSidebarItems, NAV_ITEMS } from "./nav-items";

describe("dashboard navigation", () => {
  it("shows rounds, projects, leaderboard and how-it-works links to everyone", () => {
    const anonymousPaths = filterSidebarByRole(NAV_ITEMS, "anon").map((item) => item.to);

    expect(anonymousPaths).toEqual(
      expect.arrayContaining(["/rounds", "/projects", "/leaderboard", "/how-to-integrate"]),
    );
    expect(anonymousPaths).not.toContain("/admin");
  });

  it("shows tester and project links to signed-in members", () => {
    const memberPaths = filterSidebarByRole(NAV_ITEMS, "member").map((item) => item.to);

    expect(memberPaths).toEqual(
      expect.arrayContaining(["/dashboard", "/testing", "/manage/new", "/rounds"]),
    );
  });

  it("does not list orgs in the sidebar", () => {
    const paths = filterSidebarByRole(NAV_ITEMS, "admin").map((item) => item.to);
    expect(paths).not.toContain("/orgs");
  });

  it("shows admin to admins only", () => {
    const memberPaths = filterSidebarByRole(NAV_ITEMS, "member").map((item) => item.to);
    const adminPaths = filterSidebarByRole(NAV_ITEMS, "admin").map((item) => item.to);

    expect(memberPaths).not.toContain("/admin");
    expect(adminPaths).toContain("/admin");
  });

  it("groups items into labeled sections and hides empty ones", () => {
    const anon = groupSidebarItems(filterSidebarByRole(NAV_ITEMS, "anon"));
    const member = groupSidebarItems(filterSidebarByRole(NAV_ITEMS, "member"));
    const admin = groupSidebarItems(filterSidebarByRole(NAV_ITEMS, "admin"));

    expect(anon.map((section) => section.id)).toEqual(["main", "testers"]);
    expect(member.map((section) => section.id)).toEqual(["main", "testers", "projects"]);
    expect(admin.map((section) => section.id)).toEqual(["main", "testers", "projects", "admin"]);
    expect(admin.every((section) => section.label && section.items.length > 0)).toBe(true);
  });

  it("highlights rounds on round pages but not on request a round", () => {
    expect(getActiveItem(NAV_ITEMS, "/rounds")?.label).toBe("rounds");
    expect(getActiveItem(NAV_ITEMS, "/projects")?.label).toBe("projects");
    expect(getActiveItem(NAV_ITEMS, "/projects/near-wallet/3")?.label).toBe("projects");
    expect(getActiveItem(NAV_ITEMS, "/manage/new")?.label).toBe("request a round");
    expect(getActiveItem(NAV_ITEMS, "/testing")?.label).toBe("testing");
    expect(getActiveItem(NAV_ITEMS, "/manage/near-wallet/3")?.label).toBe("manage");
    expect(getActiveItem(NAV_ITEMS, "/leaderboard")?.label).toBe("leaderboard");
    expect(getActiveItem(NAV_ITEMS, "/orgs/acme")).toBeUndefined();
    expect(getActiveItem(NAV_ITEMS, "/settings/profile")).toBeUndefined();
  });

  it("only links to pages that render inside the shell", () => {
    for (const item of NAV_ITEMS) {
      expect(shouldUseAppShell(true, item.to), item.to).toBe(true);
    }
  });
});
