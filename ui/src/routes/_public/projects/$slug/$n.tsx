import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, FileText, Inbox, MessageSquare } from "lucide-react";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundShareActions } from "@/components/round-share-actions";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { RouteTab, RouteTabs } from "@/components/route-tabs";
import { pageHead } from "@/lib/page-title";
import { loadRound, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";

export const Route = createFileRoute("/_public/projects/$slug/$n")({
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    return { title: round.title, description: round.description };
  },
  head: ({ loaderData }) => pageHead(loaderData?.title, loaderData?.description),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Round not found." backTo="/rounds" />,
  component: RoundLayout,
});

function RoundLayout() {
  const params = Route.useParams();
  const round = useRound(params);
  const viewer = useRoundViewer(round);

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/rounds"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            rounds
          </Link>
          <div className="flex flex-wrap gap-2">
            {(viewer.canManage || viewer.isAdmin) && (
              <Button asChild size="sm">
                <Link to="/manage/$slug/$n" params={params}>
                  <Inbox className="h-3.5 w-3.5" />
                  Open console
                </Link>
              </Button>
            )}
            <RoundShareActions round={round} />
          </div>
        </div>

        <PageHeader
          icon={MessageSquare}
          label={`Round ${round.projectRoundNumber}`}
          title={round.title}
          subtitle={
            <Link to="/projects/$slug" params={{ slug: params.slug }} className="hover:underline">
              {round.projectSlug}
            </Link>
          }
          actions={<RoundStatusBadge status={round.status} />}
        />

        <RouteTabs label="Round sections">
          <RouteTab to="/projects/$slug/$n" params={params} activeOptions={{ exact: true }}>
            <FileText />
            Overview
          </RouteTab>
          <RouteTab to="/projects/$slug/$n/feedback" params={params}>
            <MessageSquare />
            Feedback
          </RouteTab>
        </RouteTabs>

        <Outlet />
      </div>
    </PageContainer>
  );
}
