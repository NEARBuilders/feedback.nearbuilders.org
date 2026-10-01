import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({
  sessionQueryOptions: (_authClient: unknown, _initialSession: unknown) => ({
    queryKey: ["session"],
  }),
}));

vi.mock("@/components/layout/app-frame", () => ({ AppFrame: () => null }));

const { Route } = await import("./_authenticated");

function context(session: unknown, fetchQuery = vi.fn().mockResolvedValue(session)) {
  return { queryClient: { fetchQuery }, authClient: {}, session: undefined } as never;
}

describe("_authenticated layout beforeLoad", () => {
  it("redirects a signed-out visitor to /login with a return path", async () => {
    await expect(
      Route.options.beforeLoad?.({
        context: context(null),
        location: { href: "/rounds/123" },
      } as never),
    ).rejects.toMatchObject({ options: { to: "/login", search: { redirect: "/rounds/123" } } });
  });

  it("redirects a banned user to /login#banned", async () => {
    const session = { user: { id: "u1", banned: true }, session: {} };
    await expect(
      Route.options.beforeLoad?.({
        context: context(session),
        location: { href: "/rounds/123" },
      } as never),
    ).rejects.toMatchObject({ options: { to: "/login", hash: "banned" } });
  });

  it("returns an auth context for a signed-in, non-banned user", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    const result = await Route.options.beforeLoad?.({
      context: context(session),
      location: { href: "/rounds/123" },
    } as never);
    expect(result).toMatchObject({ auth: { isAuthenticated: true, isBanned: false } });
  });

  it("awaits a fresh fetch instead of trusting a possibly-stale cache", async () => {
    const fetchQuery = vi.fn().mockResolvedValue({ user: { id: "u1", banned: false } });
    await Route.options.beforeLoad?.({
      context: context(null, fetchQuery),
      location: { href: "/rounds/123" },
    } as never);
    expect(fetchQuery).toHaveBeenCalledOnce();
  });
});
