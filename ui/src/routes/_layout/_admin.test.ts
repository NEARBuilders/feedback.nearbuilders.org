import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({
  sessionQueryOptions: (_authClient: unknown, _initialSession: unknown) => ({
    queryKey: ["session"],
  }),
}));

const { Route } = await import("./_admin");

function context(session: unknown, fetchQuery = vi.fn().mockResolvedValue(session)) {
  return { queryClient: { fetchQuery }, authClient: {}, session: undefined } as never;
}

describe("_admin layout beforeLoad", () => {
  it("redirects a signed-out visitor to /login", async () => {
    await expect(
      Route.options.beforeLoad?.({ context: context(null), location: { href: "/admin" } } as never),
    ).rejects.toMatchObject({ options: { to: "/login" } });
  });

  it("redirects a banned admin to /login#banned", async () => {
    const session = { user: { id: "u1", banned: true, role: "admin" }, session: {} };
    await expect(
      Route.options.beforeLoad?.({
        context: context(session),
        location: { href: "/admin" },
      } as never),
    ).rejects.toMatchObject({ options: { to: "/login", hash: "banned" } });
  });

  it("redirects a non-admin signed-in user to /dashboard", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    await expect(
      Route.options.beforeLoad?.({
        context: context(session),
        location: { href: "/admin" },
      } as never),
    ).rejects.toMatchObject({ options: { to: "/dashboard" } });
  });

  it("lets an admin through with isAdmin true", async () => {
    const session = { user: { id: "u1", banned: false, role: "admin" }, session: {} };
    const result = await Route.options.beforeLoad?.({
      context: context(session),
      location: { href: "/admin" },
    } as never);
    expect(result).toMatchObject({ auth: { isAdmin: true, isBanned: false } });
  });
});
