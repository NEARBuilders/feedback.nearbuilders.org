/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPartners } from "./project-partners";

const addProjectPartner = vi.fn();
const removeProjectPartner = vi.fn();

vi.mock("@/app", () => ({
  useApiClient: () => ({ addProjectPartner, removeProjectPartner }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPartners(
  partners: Array<{ organizationId: string; slug: string | null }> = [],
  canManagePartners = true,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProjectPartners
        projectId="project-1"
        partners={partners}
        canManagePartners={canManagePartners}
      />
    </QueryClientProvider>,
  );
}

describe("ProjectPartners", () => {
  beforeEach(() => {
    addProjectPartner.mockReset();
    removeProjectPartner.mockReset();
  });

  afterEach(cleanup);

  it("renders nothing for callers who cannot manage partners", () => {
    renderPartners([{ organizationId: "org-1", slug: "nearlytrade" }], false);

    expect(screen.queryByTestId("project-partners")).toBeNull();
  });

  it("adds a partner by slug", async () => {
    addProjectPartner.mockResolvedValue({
      partners: [{ organizationId: "org-2", slug: "nearlytrade" }],
    });
    renderPartners();

    fireEvent.change(screen.getByTestId("project-partners-slug"), {
      target: { value: "nearlytrade" },
    });
    fireEvent.click(screen.getByRole("button", { name: "add partner" }));

    await waitFor(() => expect(addProjectPartner).toHaveBeenCalled());
    expect(addProjectPartner.mock.calls[0]?.[0]).toEqual({
      id: "project-1",
      organizationSlug: "nearlytrade",
    });
  });

  it("surfaces the server's refusal for an unknown org", async () => {
    addProjectPartner.mockRejectedValue(new Error("No organization found with that slug"));
    renderPartners();

    fireEvent.change(screen.getByTestId("project-partners-slug"), {
      target: { value: "ghost-org" },
    });
    fireEvent.click(screen.getByRole("button", { name: "add partner" }));

    await waitFor(() => expect(addProjectPartner).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No organization found with that slug"),
    );
  });

  it("removes a partner after confirming", async () => {
    removeProjectPartner.mockResolvedValue({ partners: [] });
    renderPartners([{ organizationId: "org-2", slug: "nearlytrade" }]);

    fireEvent.click(screen.getByTestId("project-partners-remove-nearlytrade"));
    fireEvent.click(await screen.findByRole("button", { name: "Remove partner" }));

    await waitFor(() => expect(removeProjectPartner).toHaveBeenCalled());
    expect(removeProjectPartner.mock.calls[0]?.[0]).toEqual({
      id: "project-1",
      organizationSlug: "nearlytrade",
    });
  });
});
