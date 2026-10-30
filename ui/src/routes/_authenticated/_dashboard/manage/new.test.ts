import { ORPCError } from "@orpc/client";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({}));

const { Route } = await import("./new");

function load(project: string | undefined, getProjectBySlug: ReturnType<typeof vi.fn>) {
  return Promise.resolve(
    (Route.options.loader as (opts: never) => unknown)({
      context: { queryClient: new QueryClient(), apiClient: { getProjectBySlug } },
      deps: { project },
    } as never),
  );
}

describe("/manage/new loader", () => {
  it("loads the project when the slug is known", async () => {
    const getProjectBySlug = vi
      .fn()
      .mockResolvedValue({ id: "p1", slug: "wallet", name: "Wallet" });
    await expect(load("wallet", getProjectBySlug)).resolves.toMatchObject({
      project: { slug: "wallet" },
    });
  });

  it("falls back to the request form instead of a 404 when the project is unknown", async () => {
    const getProjectBySlug = vi.fn().mockRejectedValue(new ORPCError("NOT_FOUND"));
    await expect(load("brand-new", getProjectBySlug)).resolves.toEqual({
      project: null,
      previous: null,
    });
  });

  it("renders the empty form when no project param is given", async () => {
    const getProjectBySlug = vi.fn();
    await expect(load(undefined, getProjectBySlug)).resolves.toEqual({
      project: null,
      previous: null,
    });
    expect(getProjectBySlug).not.toHaveBeenCalled();
  });

  it("still surfaces unexpected errors", async () => {
    const getProjectBySlug = vi.fn().mockRejectedValue(new ORPCError("INTERNAL_SERVER_ERROR"));
    await expect(load("wallet", getProjectBySlug)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
