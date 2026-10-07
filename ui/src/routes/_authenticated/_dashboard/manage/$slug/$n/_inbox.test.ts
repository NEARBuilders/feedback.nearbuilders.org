import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { inboxFilters, validateInboxSearch } = await import("./_inbox");

describe("inbox search params", () => {
  it("defaults to unresolved feedback from everyone", () => {
    expect(validateInboxSearch({} as never)).toEqual({ status: "unresolved", author: undefined });
  });

  it("keeps a valid status and author and drops junk", () => {
    expect(validateInboxSearch({ status: "dismissed", author: "a.near" } as never)).toEqual({
      status: "dismissed",
      author: "a.near",
    });
    expect(validateInboxSearch({ status: "bogus", author: "" } as never).status).toBe("unresolved");
  });

  it("asks the API for every status when filtering by all", () => {
    expect(inboxFilters({ status: "all", author: "a.near" })).toEqual({
      status: undefined,
      author: "a.near",
    });
  });

  it("maps the starred filter onto the starred API flag (#104)", () => {
    expect(inboxFilters({ status: "starred", author: undefined })).toEqual({
      status: undefined,
      starred: true,
      author: undefined,
    });
    expect(validateInboxSearch({ status: "starred" } as never)).toEqual({
      status: "starred",
      author: undefined,
    });
  });
});
