/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ fail: true }));

const apiClient = new Proxy(
  {},
  {
    get: () => () => (state.fail ? Promise.reject(new Error("API down")) : Promise.resolve([])),
  },
);
const authResult = (data: unknown) => () =>
  Promise.resolve(
    state.fail ? { data: null, error: { message: "API down" } } : { data, error: null },
  );
const org = { id: "org1", slug: "acme", name: "Acme" };
const authClient: Record<string, Record<string, () => Promise<unknown>>> = {
  organization: {
    list: () => Promise.resolve({ data: [org], error: null }),
    listMembers: authResult({ members: [] }),
    listInvitations: authResult([]),
    listUserInvitations: authResult([]),
  },
  apiKey: { list: authResult({ apiKeys: [] }) },
};

vi.mock("@/app", () => ({
  useApiClient: () => apiClient,
  useAuthClient: () => authClient,
  sessionQueryKey: ["session"],
  sessionQueryOptions: () => ({
    queryKey: ["session"],
    queryFn: async () => ({
      user: { id: "u1", name: "Tester", email: "t@x.io", role: "admin" },
      session: { activeOrganizationId: "org1" },
    }),
  }),
  apiConnectionError: () => null,
  getAccount: () => "",
  getActiveRuntime: () => ({}),
  getAppName: () => "x",
  getBaseStyles: () => "",
  getRepository: () => "",
}));
vi.mock("@/lib/use-near-account", () => ({
  useNearAccountStatus: () => ({ accountId: "alice.near", isDetecting: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    useNavigate: () => vi.fn(),
    useRouter: () => ({ navigate: vi.fn(), invalidate: vi.fn() }),
  };
});

function mount(Component: () => React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Component />
    </QueryClientProvider>,
  );
}

type RouteModule = { Route: unknown };
const routeComponent = (mod: RouteModule) =>
  (mod.Route as { options: { component: () => React.ReactNode } }).options.component;

const TIMEOUT = 60_000;

describe("failed requests are not shown as empty data", { timeout: TIMEOUT }, () => {
  beforeEach(() => {
    state.fail = true;
    authClient.organization.list = () => Promise.resolve({ data: [org], error: null });
  });
  afterEach(cleanup);

  it("manage/index shows an error with Retry, not the empty state", async () => {
    const mod = await import("@/routes/_authenticated/_dashboard/manage/index");
    mount(routeComponent(mod));

    await screen.findByRole("alert");
    expect(screen.queryByText("You don't manage any rounds yet.")).toBeNull();
    state.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("You don't manage any rounds yet.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("admin/projects shows an error, not the empty queue", async () => {
    const mod = await import("@/routes/_admin/_dashboard/admin/projects");
    mount(routeComponent(mod));

    await screen.findByRole("alert");
    expect(screen.queryByText("No projects are waiting for review.")).toBeNull();
  });

  it("my-projects shows an error instead of disappearing", async () => {
    const { MyProjects } = await import("@/components/my-projects");
    mount(MyProjects);

    await screen.findByRole("alert");
    expect(screen.getByText("Your projects")).toBeTruthy();
  });

  it("orgs/index shows an error when the organization list returns an error", async () => {
    authClient.organization.list = authResult([org]);
    const mod = await import("@/routes/_authenticated/_dashboard/orgs/index");
    mount(routeComponent(mod));

    await screen.findByText("Couldn't load your organizations.");
    expect(screen.queryByText("No organizations yet.")).toBeNull();
  });

  it("settings/api-keys shows an error, not 'No API keys yet'", async () => {
    const mod = await import("@/routes/_authenticated/_dashboard/settings/api-keys");
    mount(routeComponent(mod));

    await screen.findByRole("alert");
    expect(screen.queryByText("No API keys yet")).toBeNull();
  });

  it("dashboard shows placeholders and an error, not zero counts", async () => {
    const mod = await import("@/routes/_authenticated/_dashboard/dashboard/index");
    const { container } = mount(routeComponent(mod));

    await waitFor(() => expect(screen.getAllByRole("alert").length).toBe(2));
    expect(container.textContent).not.toMatch(/Rounds joined\s*0/);
    expect(container.textContent).not.toMatch(/Open rounds\s*0/);
    expect(container.textContent).toMatch(/Rounds joined\s*—/);
  });

  it("orgs/$slug shows errors for members, invitations and API keys", async () => {
    const mod = await import("@/routes/_authenticated/_dashboard/orgs/$slug");
    (mod.Route as unknown as { useParams: () => unknown }).useParams = () => ({ slug: "acme" });
    mount(routeComponent(mod));

    await screen.findByText("Couldn't load members.");
    expect(screen.queryByText("No members found")).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Invitations/ }), { button: 0 });
    await screen.findByText("Couldn't load invitations.");
    expect(screen.queryByText("No pending invitations")).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /API Keys/ }), { button: 0 });
    await screen.findByText("Couldn't load API keys.");
    expect(screen.queryByText("No API keys")).toBeNull();
  });
});
