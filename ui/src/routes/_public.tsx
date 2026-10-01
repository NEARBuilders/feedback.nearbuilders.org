import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppFrame } from "@/components/layout/app-frame";
import { PublicShell, PublicShellFooter } from "@/components/layout/public-shell";

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
});

function PublicLayout() {
  return (
    <AppFrame>
      <PublicShell footer={<PublicShellFooter />}>
        <Outlet />
      </PublicShell>
    </AppFrame>
  );
}
