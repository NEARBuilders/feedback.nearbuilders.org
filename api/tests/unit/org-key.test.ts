import { describe, expect, it } from "vitest";
import { orgKeyOrganizationId } from "@/services/org-key";

describe("orgKeyOrganizationId (#111)", () => {
  it("returns the organization of an organization API key", () => {
    expect(
      orgKeyOrganizationId({
        apiKey: { id: "key-1" },
        principal: { type: "organization", organizationId: "org-1" },
      }),
    ).toBe("org-1");
  });

  it("ignores sessions, personal keys and anonymous callers", () => {
    expect(orgKeyOrganizationId({})).toBeNull();
    expect(
      orgKeyOrganizationId({ principal: { type: "organization", organizationId: "org-1" } }),
    ).toBeNull();
    expect(orgKeyOrganizationId({ apiKey: { id: "k" }, principal: { type: "user" } })).toBeNull();
    expect(
      orgKeyOrganizationId({
        apiKey: { id: "k" },
        principal: { type: "organization", organizationId: "" },
      }),
    ).toBeNull();
    expect(orgKeyOrganizationId({ apiKey: { id: "k" }, principal: null })).toBeNull();
  });
});
