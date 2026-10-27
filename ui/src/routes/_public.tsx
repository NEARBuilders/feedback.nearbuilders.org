import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicShell, PublicShellFooter } from "@/components/layout/public-shell";
import { useAppShellState } from "@/components/layout/use-app-shell";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  const { useAppShell } = useAppShellState();

  // Signed-in users get the app shell from the root route.
  if (useAppShell) return <Outlet />;

  return (
    <PublicShell footer={<PublicShellFooter />}>
      <Outlet />
    </PublicShell>
  );
}
