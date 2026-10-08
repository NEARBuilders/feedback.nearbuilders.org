import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { PageContainer, PageHeader } from "@/components";
import { pageHead } from "@/lib/page-title";

export const Route = createFileRoute("/_admin/_dashboard/admin")({
  head: () => pageHead("Admin"),
  component: AdminPage,
});

// TODO(phase 6): real admin surface for feedback rounds (moderation, source trust, etc.).
function AdminPage() {
  return (
    <PageContainer variant="wide">
      <div className="space-y-8">
        <PageHeader icon={Shield} label="Admin" title="Admin" />
        <Outlet />
      </div>
    </PageContainer>
  );
}
