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
    expect(getBreadcrumbs("/feed/round_1")[1].label).toBe("round");
  });

  it("looks up organization names and falls back to the slug", () => {
    const orgName = (slug: string) => (slug === "acme" ? "Acme Inc" : undefined);
    expect(getBreadcrumbs("/orgs/acme", { orgName })[1].label).toBe("Acme Inc");
    expect(getBreadcrumbs("/orgs/other", { orgName })[1].label).toBe("other");
  });
});
