import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundShareActions } from "@/components/round-share-actions";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { RouteTab, RouteTabs } from "@/components/route-tabs";
import { pageHead } from "@/lib/page-title";
import { loadRound, useRound } from "@/lib/round-route";

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
          <RoundShareActions round={round} />
        </div>

        <PageHeader
          icon={MessageSquare}
          label={`Round ${round.projectRoundNumber}`}
          title={round.title}
          subtitle={round.projectSlug}
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
