import { createFileRoute, Link } from "@tanstack/react-router";
import { Settings, Users } from "lucide-react";
import { getAccount } from "@/app";
import { Button, Card, SectionHeader } from "@/components";
import { useNearAccount } from "@/lib/use-near-account";

export const Route = createFileRoute("/_layout/_admin/_dashboard/admin/")({
  head: () => ({
    meta: [{ title: "Admin Dashboard" }],
  }),
  component: AdminDashboard,
});

// TODO(phase 6): surface feedback-round admin tools here.
function AdminDashboard() {
  const { auth } = Route.useRouteContext();
  const platformAccount = getAccount();
  const user = auth?.user ?? null;
  const walletAccount = useNearAccount();

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet" value={walletAccount ?? user?.name ?? "—"} mono />
        <StatCard label="Name" value={user?.name || user?.email || "—"} />
        <StatCard label="Role" value={user?.role ?? "—"} />
        <StatCard label="Platform account" value={platformAccount} mono />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Manage" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-foreground text-background">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Organizations</h3>
            <p className="text-sm text-muted-foreground">
              Manage organizations, members, roles, and invitations.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/orgs">open organizations</Link>
            </Button>
          </Card>

          <Card className="p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-foreground text-background">
              <Settings className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Settings</h3>
            <p className="text-sm text-muted-foreground">
              Update your profile, auth methods, and security preferences.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">open settings</Link>
            </Button>
          </Card>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="border-2 border-outset border-border-strong bg-card p-4 rounded-[12px] shadow-sm space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-base font-bold text-foreground leading-tight ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
