import { requireSession } from "everything-dev/ui/auth";
import { describe, expect, it, vi } from "vitest";

const { Route } = await import("./_authenticated");

// The framework guard resolves the session through the framework
// sessionQueryOptions → authClient.getSession(); a queryClient test double
// runs the real queryFn so the contract stays exercised.
function client(session: unknown) {
  const authClient = {
    getSession: vi.fn().mockResolvedValue({ data: session, error: null }),
  };
  const queryClient = {
    query: (opts: { queryFn: () => Promise<unknown> }) => opts.queryFn(),
  };
  return { authClient, queryClient };
}

function args(session: unknown, href: string) {
  return { context: client(session), location: { href } } as never;
}

describe("_authenticated layout beforeLoad", () => {
  it("delegates to the framework requireSession guard", () => {
    expect(Route.options.beforeLoad).toBe(requireSession);
  });

  it("redirects a signed-out visitor to /login with a return path (href-based)", async () => {
    await expect(Route.options.beforeLoad?.(args(null, "/rounds/123"))).rejects.toMatchObject({
      options: { href: "/login?redirect=%2Frounds%2F123" },
    });
  });

  it("redirects a banned user to /login#banned", async () => {
    const session = { user: { id: "u1", banned: true }, session: {} };
    await expect(Route.options.beforeLoad?.(args(session, "/rounds/123"))).rejects.toMatchObject({
      options: { href: "/login#banned" },
    });
  });

  it("returns an auth context for a signed-in, non-banned user", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    const result = await Route.options.beforeLoad?.(args(session, "/rounds/123"));
    expect(result).toMatchObject({ auth: { isAuthenticated: true, isBanned: false } });
  });

  it("resolves the session through the framework cookie-cache-bypass contract", async () => {
    const { authClient, queryClient } = client({ user: { id: "u1", banned: false }, session: {} });
    await Route.options.beforeLoad?.({
      context: { authClient, queryClient },
      location: { href: "/rounds/123" },
    } as never);
    expect(authClient.getSession).toHaveBeenCalledWith({
      query: { disableCookieCache: true },
    });
  });
});
