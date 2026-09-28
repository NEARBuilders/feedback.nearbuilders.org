import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({
  sessionQueryOptions: (_authClient: unknown, _initialSession: unknown) => ({
    queryKey: ["session"],
  }),
}));

const { rejectAuthed, requireAdmin, requireSession } = await import("./auth-guards");

function buildContext(session: unknown, options: { fetchQuery?: ReturnType<typeof vi.fn> } = {}) {
  return {
    queryClient: {
      fetchQuery: options.fetchQuery ?? vi.fn().mockResolvedValue(session),
      getQueryData: () => session,
    },
    authClient: {},
    session: undefined,
  } as never;
}

describe("requireSession", () => {
  it("redirects a signed-out visitor to /login with a return path", async () => {
    await expect(
      requireSession({ context: buildContext(null), location: { href: "/dashboard" } }),
    ).rejects.toMatchObject({ options: { to: "/login", search: { redirect: "/dashboard" } } });
  });

  it("redirects a banned user to /login#banned instead of into the app", async () => {
    const session = { user: { id: "u1", banned: true } };
    await expect(
      requireSession({ context: buildContext(session), location: { href: "/dashboard" } }),
    ).rejects.toMatchObject({ options: { to: "/login", hash: "banned" } });
  });

  it("returns an auth context for a signed-in, non-banned session", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    const result = await requireSession({
      context: buildContext(session),
      location: { href: "/dashboard" },
    });
    expect(result.auth).toMatchObject({ isAuthenticated: true, isBanned: false, isAdmin: false });
  });

  it("awaits a fresh fetch instead of returning a stale cached session", async () => {
    const fetchQuery = vi.fn().mockResolvedValue({ user: { id: "u1", banned: false } });
    const context = buildContext(null, { fetchQuery });

    await requireSession({ context, location: { href: "/dashboard" } });

    expect(fetchQuery).toHaveBeenCalledOnce();
    expect(
      (context as { queryClient: { ensureQueryData?: unknown } }).queryClient.ensureQueryData,
    ).toBeUndefined();
  });
});

describe("requireAdmin", () => {
  it("redirects a non-admin signed-in user to /dashboard", async () => {
    const session = { user: { id: "u1", banned: false, role: "member" }, session: {} };
    await expect(
      requireAdmin({ context: buildContext(session), location: { href: "/admin" } }),
    ).rejects.toMatchObject({ options: { to: "/dashboard" } });
  });

  it("lets an admin through", async () => {
    const session = { user: { id: "u1", banned: false, role: "admin" }, session: {} };
    const result = await requireAdmin({
      context: buildContext(session),
      location: { href: "/admin" },
    });
    expect(result.auth.isAdmin).toBe(true);
  });
});

describe("rejectAuthed", () => {
  it("redirects an authenticated, non-banned visitor away from anon-only pages", async () => {
    const session = { user: { id: "u1", banned: false } };
    await expect(
      rejectAuthed({ context: buildContext(session), location: { href: "/login" } }),
    ).rejects.toMatchObject({ options: { to: "/dashboard" } });
  });

  it("does not redirect a banned visitor, breaking the login<->dashboard loop", async () => {
    const session = { user: { id: "u1", banned: true } };
    await expect(
      rejectAuthed({ context: buildContext(session), location: { href: "/login" } }),
    ).resolves.toBeUndefined();
  });

  it("does not redirect a signed-out visitor", async () => {
    await expect(
      rejectAuthed({ context: buildContext(null), location: { href: "/login" } }),
    ).resolves.toBeUndefined();
  });
});
