import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Eye, Inbox, LayoutDashboard } from "lucide-react";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { RouteTab, RouteTabs } from "@/components/route-tabs";
import { pageHead } from "@/lib/page-title";
import { loadRound, useRound } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/$n")({
  beforeLoad: async ({ context, params }) => {
    const round = await loadRound(context, params);
    if (!round.canManage && !context.auth.isAdmin) {
      throw redirect({ to: "/projects/$slug/$n", params });
    }
  },
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    return { title: round.title };
  },
  head: ({ loaderData }) => pageHead(loaderData && `Console · ${loaderData.title}`),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Round not found." backTo="/manage" />,
  component: ConsoleLayout,
});

function ConsoleLayout() {
  const params = Route.useParams();
  const round = useRound(params);

  return (
    <PageContainer variant="wide">
      <div className="space-y-6">
        <PageHeader
          icon={LayoutDashboard}
          label="Console"
          title={round.title}
          subtitle={`${round.projectSlug} · round ${round.projectRoundNumber}`}
          actions={
            <>
              <RoundStatusBadge status={round.status} />
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/$slug/$n" params={params}>
                  <Eye className="h-3.5 w-3.5" />
                  Public page
                </Link>
              </Button>
            </>
          }
        />

        <RouteTabs label="Console sections">
          <RouteTab to="/manage/$slug/$n" params={params} search>
            <Inbox />
            Inbox
          </RouteTab>
        </RouteTabs>

        <Outlet />
      </div>
    </PageContainer>
  );
}
