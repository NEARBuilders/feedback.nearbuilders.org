import { describe, expect, it } from "vitest";
import { getBreadcrumbs } from "./breadcrumbs";

describe("getBreadcrumbs", () => {
  it("returns nothing for the root", () => {
    expect(getBreadcrumbs("/")).toEqual([]);
  });

  it("builds cumulative hrefs", () => {
    expect(getBreadcrumbs("/settings/profile")).toEqual([
      { label: "settings", href: "/settings" },
      { label: "profile", href: "/settings/profile" },
    ]);
  });

  it("labels known routes", () => {
    expect(getBreadcrumbs("/how-to-integrate")[0].label).toBe("how it works");
    expect(getBreadcrumbs("/feed/request")[1].label).toBe("request a round");
  });

  it("labels the round number in canonical round URLs", () => {
    expect(getBreadcrumbs("/projects/near-wallet/3/feedback").map((c) => c.label)).toEqual([
      "projects",
      "near-wallet",
      "round 3",
      "feedback",
    ]);
    expect(getBreadcrumbs("/manage/near-wallet/3")[2].label).toBe("round 3");
    expect(getBreadcrumbs("/testing/near-wallet/3")[2].label).toBe("round 3");
    expect(getBreadcrumbs("/manage/near-wallet/3/0b5c-uuid")[3].label).toBe("feedback");
    expect(getBreadcrumbs("/manage/near-wallet/3/settings")[3].label).toBe("settings");
  });

  it("looks up organization names and falls back to the slug", () => {
    const orgName = (slug: string) => (slug === "acme" ? "Acme Inc" : undefined);
    expect(getBreadcrumbs("/orgs/acme", { orgName })[1].label).toBe("Acme Inc");
    expect(getBreadcrumbs("/orgs/other", { orgName })[1].label).toBe("other");
  });
});
