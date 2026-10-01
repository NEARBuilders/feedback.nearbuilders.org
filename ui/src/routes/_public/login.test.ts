import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({
  sessionQueryOptions: (_authClient: unknown, _initialSession: unknown) => ({
    queryKey: ["session"],
  }),
  useAuthClient: () => ({}),
}));

vi.mock("@/components", () => ({ Button: () => null }));
vi.mock("@/components/under-construction", () => ({ UnderConstruction: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { Route } = await import("./login");

function context(session: unknown) {
  return {
    queryClient: { getQueryData: () => session },
    authClient: {},
    session: undefined,
  } as never;
}

describe("login route beforeLoad", () => {
  it("redirects a signed-in, non-banned visitor away from /login", () => {
    expect(() =>
      Route.options.beforeLoad?.({
        context: context({ user: { banned: false } }),
        search: {},
      } as never),
    ).toThrowError();
  });

  it("sends a signed-in, non-banned visitor to their requested redirect path", () => {
    try {
      Route.options.beforeLoad?.({
        context: context({ user: { banned: false } }),
        search: { redirect: "/rounds/123" },
      } as never);
      throw new Error("expected beforeLoad to throw a redirect");
    } catch (thrown) {
      expect(thrown).toMatchObject({ options: { to: "/rounds/123" } });
    }
  });

  it("does not redirect a banned visitor away from /login, avoiding the bounce loop", () => {
    expect(
      Route.options.beforeLoad?.({
        context: context({ user: { banned: true } }),
        search: {},
      } as never),
    ).toBeUndefined();
  });

  it("does not redirect a signed-out visitor", () => {
    expect(
      Route.options.beforeLoad?.({ context: context(null), search: {} } as never),
    ).toBeUndefined();
  });
});
