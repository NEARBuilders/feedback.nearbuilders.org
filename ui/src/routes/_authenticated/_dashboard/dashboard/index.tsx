import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  Home as HomeIcon,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button, Card } from "@/components";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { pageHead } from "@/lib/page-title";
import { joinedRoundsQueryOptions } from "@/lib/queries/participation";
import { ownerSummaryQueryOptions } from "@/lib/queries/rounds";
import { groupWorkspaceRounds } from "@/lib/tester-workspace";
import { useNearAccountStatus } from "@/lib/use-near-account";

/**
 * The post-login landing place. It answers one question a builder who is both
 * a tester and an owner has nowhere else: "what, across both roles, needs me
 * right now?" Everything here summarizes and links elsewhere — it holds no
 * list of its own, so there is nothing here to duplicate /testing or /manage.
 */
export const Route = createFileRoute("/_authenticated/_dashboard/dashboard/")({
  head: () => pageHead("Dashboard", "Your workspace."),
  component: Home,
});

function Home() {
  const auth = useAuthClient();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const user = session?.user ?? null;
  const activeOrgId = session?.session?.activeOrganizationId ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={HomeIcon}
        label="Workspace"
        title={user?.name || user?.email || "You"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/manage/new" preload="intent">
                request a round
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings" preload="intent">
                <Settings />
                settings
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TestingSummary />
        {activeOrgId && <OwnerSummary orgId={activeOrgId} />}
      </div>
    </div>
  );
}

function TestingSummary() {
  const apiClient = useApiClient();
  const { accountId, isDetecting } = useNearAccountStatus();
  const { data: joined, isLoading } = useQuery({
    ...joinedRoundsQueryOptions(apiClient),
    enabled: !!accountId,
  });

  if (!accountId && !isDetecting) {
    return (
      <Card className="space-y-3 p-6">
        <SummaryHeader icon={ClipboardCheck} title="Testing" />
        <p className="text-sm text-muted-foreground">
          Link a NEAR account to join rounds and give feedback.{" "}
          <Link to="/settings/auth-methods" className="text-foreground underline">
            Link one now
          </Link>
          .
        </p>
      </Card>
    );
  }

  const groups = groupWorkspaceRounds(joined ?? []);

  return (
    <Card className="space-y-4 p-6">
      <SummaryHeader icon={ClipboardCheck} title="Testing" />
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Need your feedback"
          value={isLoading ? "—" : groups.needsFeedback.length}
        />
        <StatCard label="Rounds joined" value={isLoading ? "—" : (joined?.length ?? 0)} />
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/testing">
          go to testing
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
}

function OwnerSummary({ orgId }: { orgId: string }) {
  const apiClient = useApiClient();
  const { data, isLoading } = useQuery(ownerSummaryQueryOptions(apiClient, orgId));

  return (
    <Card className="space-y-4 p-6">
      <SummaryHeader icon={LayoutDashboard} title="Managing" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open rounds" value={isLoading ? "—" : (data?.openRounds ?? 0)} />
        <StatCard label="Unresolved" value={isLoading ? "—" : (data?.unresolvedFeedback ?? 0)} />
        <StatCard label="Pending" value={isLoading ? "—" : (data?.pendingProjects ?? 0)} />
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to="/manage">
          go to manage
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </Card>
  );
}

function SummaryHeader({ icon: Icon, title }: { icon: typeof ClipboardCheck; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}
