import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { getAccount } from "@/app";
import { PageContainer, PageHeader } from "@/components";

export const Route = createFileRoute("/_layout/_admin/_dashboard/admin")({
  head: () => ({
    meta: [{ title: "Admin" }],
  }),
  beforeLoad: async ({ context }) => {
    const { apiClient, runtimeConfig } = context;
    const accountId = getAccount(runtimeConfig);
    let tenant: Awaited<ReturnType<typeof apiClient.resolveTenant>> | null = null;
    try {
      tenant = await apiClient.resolveTenant({ accountId });
    } catch {
      tenant = null;
    }
    return { tenant };
  },
  component: AdminPage,
});

// TODO(phase 6): real admin surface for feedback rounds (moderation, source trust, etc.).
function AdminPage() {
  const { tenant } = Route.useRouteContext();

  return (
    <PageContainer variant="wide">
      <div className="space-y-8">
        <PageHeader
          icon={Shield}
          label="Admin"
          title={tenant?.name ?? "Admin"}
          subtitle={tenant ? `${tenant.id.slice(0, 8)} · ${tenant.accountId}` : undefined}
        />
        <Outlet />
      </div>
    </PageContainer>
  );
}
