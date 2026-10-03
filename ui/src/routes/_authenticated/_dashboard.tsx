import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_dashboard")({
  component: DashboardLayout,
});

// The shell is rendered once by the root route.
function DashboardLayout() {
  return <Outlet />;
}
