import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageContainer } from "@/components";

export const Route = createFileRoute("/_authenticated/_dashboard/orgs")({
  component: OrgsLayout,
});

function OrgsLayout() {
  return (
    <PageContainer variant="default">
      <Outlet />
    </PageContainer>
  );
}
