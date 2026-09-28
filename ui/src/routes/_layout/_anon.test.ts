import { describe, expect, it, vi } from "vitest";

vi.mock("@/app", () => ({
  sessionQueryOptions: (_authClient: unknown, _initialSession: unknown) => ({
    queryKey: ["session"],
  }),
}));

vi.mock("@/components/layout/public-shell", () => ({
  PublicShell: () => null,
  PublicShellFooter: () => null,
}));

const { Route } = await import("./_anon");

function context(session: unknown) {
  return {
    queryClient: { getQueryData: () => session },
    authClient: {},
    session: undefined,
  } as never;
}

describe("_anon layout beforeLoad", () => {
  it("redirects a signed-in, non-banned visitor to /dashboard", async () => {
    await expect(
      Route.options.beforeLoad?.({ context: context({ user: { banned: false } }) } as never),
    ).rejects.toMatchObject({ options: { to: "/dashboard" } });
  });

  it("does not redirect a banned session, so it can reach /login for the banned message", async () => {
    await expect(
      Route.options.beforeLoad?.({ context: context({ user: { banned: true } }) } as never),
    ).resolves.toBeUndefined();
  });

  it("does not redirect a signed-out visitor", async () => {
    await expect(
      Route.options.beforeLoad?.({ context: context(null) } as never),
    ).resolves.toBeUndefined();
  });
});
