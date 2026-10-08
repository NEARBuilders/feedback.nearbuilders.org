import { createFileRoute, Link, Outlet, type SearchSchemaInput } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileText,
  Inbox,
  MessageSquare,
  PenLine,
  PictureInPicture2,
} from "lucide-react";
import { Button, VerifiedBadge } from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ProductLink } from "@/components/project-identity";
import { RoundShareActions } from "@/components/round-share-actions";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { RouteTab, RouteTabs } from "@/components/route-tabs";
import { isCompact } from "@/lib/app-shell";
import { pageHead } from "@/lib/page-title";
import { loadRound, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_public/projects/$slug/$n")({
  // Compact drops the app shell (see lib/app-shell.ts) so a tester can keep
  // this open in a narrow window beside the product they're testing.
  validateSearch: (search: { compact?: unknown } & SearchSchemaInput): { compact?: true } =>
    isCompact(search) ? { compact: true } : {},
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

function popOut() {
  window.open(
    `${window.location.pathname}?compact=1`,
    "feedback-workspace",
    "popup,width=520,height=900",
  );
}

function OwnerLine({ ownerAccountId }: { ownerAccountId: string }) {
  return (
    <div className="flex items-center gap-2" data-testid="round-owner">
      <AccountAvatar accountId={ownerAccountId} className="h-6 w-6" />
      <span className="text-sm text-muted-foreground">run by</span>
      <Link
        to="/$accountId"
        params={{ accountId: ownerAccountId }}
        className="font-mono text-sm text-foreground hover:underline"
      >
        {ownerAccountId}
      </Link>
    </div>
  );
}

function RoundLayout() {
  const params = Route.useParams();
  const { compact } = Route.useSearch();
  const round = useRound(params);
  const viewer = useRoundViewer(round);
  const projectName = round.identity?.title ?? round.projectSlug;
  // Testers only get their own tab once they can actually post into the round.
  const canSubmit = viewer.canPost || viewer.joined;

  return (
    <PageContainer className={cn(compact && "py-4 sm:py-4")}>
      <div className="space-y-6">
        {!compact && (
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/rounds"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              rounds
            </Link>
            <div className="flex flex-wrap gap-2">
              <ProductLink identity={round.identity} />
              {canSubmit && (
                <Button variant="outline" size="sm" onClick={popOut}>
                  <PictureInPicture2 className="h-3.5 w-3.5" />
                  pop out
                </Button>
              )}
              {(viewer.canManage || viewer.isAdmin) && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/manage/$slug/$n" params={params}>
                    <Inbox className="h-3.5 w-3.5" />
                    open console
                  </Link>
                </Button>
              )}
              <RoundShareActions round={round} />
            </div>
          </div>
        )}

        <PageHeader
          icon={MessageSquare}
          label={
            <Link to="/projects/$slug" params={{ slug: params.slug }} className="hover:underline">
              {projectName} · round {round.projectRoundNumber}
            </Link>
          }
          title={round.title}
          description={compact ? undefined : round.description}
          actions={
            compact ? (
              <>
                <RoundStatusBadge status={round.status} />
                {round.projectVerifiedAt && <VerifiedBadge />}
                <ProductLink identity={round.identity} />
              </>
            ) : (
              <>
                <RoundStatusBadge status={round.status} />
                {round.projectVerifiedAt && <VerifiedBadge />}
              </>
            )
          }
        />

        {!compact && <OwnerLine ownerAccountId={round.ownerAccountId} />}

        {!compact && (
          <RouteTabs label="Round sections">
            <RouteTab to="/projects/$slug/$n" params={params} activeOptions={{ exact: true }}>
              <FileText />
              overview
            </RouteTab>
            <RouteTab to="/projects/$slug/$n/feedback" params={params}>
              <MessageSquare />
              feedback
            </RouteTab>
            {canSubmit && (
              <RouteTab to="/projects/$slug/$n/submit" params={params}>
                <PenLine />
                your feedback
              </RouteTab>
            )}
          </RouteTabs>
        )}

        <Outlet />
      </div>
    </PageContainer>
  );
}
