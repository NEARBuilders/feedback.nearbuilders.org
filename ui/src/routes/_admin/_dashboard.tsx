import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/_dashboard")({
  component: AdminDashboardLayout,
});

// The shell is rendered once by the root route.
function AdminDashboardLayout() {
  return <Outlet />;
}
