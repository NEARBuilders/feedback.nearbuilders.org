import { describe, expect, it, vi } from "vitest";

const { Route } = await import("./_admin");

function client(session: unknown) {
  const authClient = {
    getSession: vi.fn().mockResolvedValue({ data: session, error: null }),
  };
  const queryClient = {
    query: (opts: { queryFn: () => Promise<unknown> }) => opts.queryFn(),
  };
  return { authClient, queryClient };
}

function args(session: unknown) {
  return { context: client(session), location: { href: "/admin" } } as never;
}

describe("_admin layout beforeLoad", () => {
  it("redirects a signed-out visitor to /login with a return path", async () => {
    await expect(Route.options.beforeLoad?.(args(null))).rejects.toMatchObject({
      options: { href: "/login?redirect=%2Fadmin" },
    });
  });

  it("redirects a banned admin to /login#banned", async () => {
    const session = { user: { id: "u1", banned: true, role: "admin" }, session: {} };
    await expect(Route.options.beforeLoad?.(args(session))).rejects.toMatchObject({
      options: { href: "/login#banned" },
    });
  });

  it("redirects a non-admin signed-in user to /dashboard", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    await expect(Route.options.beforeLoad?.(args(session))).rejects.toMatchObject({
      options: { to: "/dashboard", search: { restricted: "admin" } },
    });
  });

  it("lets an admin through with isAdmin true", async () => {
    const session = { user: { id: "u1", banned: false, role: "admin" }, session: {} };
    const result = await Route.options.beforeLoad?.(args(session));
    expect(result).toMatchObject({ auth: { isAdmin: true, isBanned: false } });
  });
});
