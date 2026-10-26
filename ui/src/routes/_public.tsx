import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicShell, PublicShellFooter } from "@/components/layout/public-shell";
import { useAppShell } from "@/components/layout/use-app-shell";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  // The root already renders the app shell around us — step aside and let the page fill it.
  if (useAppShell()) return <Outlet />;

  return (
    <PublicShell footer={<PublicShellFooter />}>
      <Outlet />
    </PublicShell>
  );
}
