import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, type SearchSchemaInput } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Eye,
  GitBranch,
  PictureInPicture2,
} from "lucide-react";
import { useApiClient } from "@/app";
import { Button, Card, EmptyState, Markdown, SectionHeader } from "@/components";
import { FeedbackComposer } from "@/components/feedback-composer";
import { FeedbackList } from "@/components/feedback-list";
import { PageContainer } from "@/components/layout/page-container";
import { RoundStatusBadge } from "@/components/round-status-badge";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { isCompact } from "@/lib/app-shell";
import { pageHead } from "@/lib/page-title";
import { myFeedbackQueryOptions } from "@/lib/queries/feedback";
import { loadRound, type RoundDetail, useRound } from "@/lib/round-route";
import { useRoundViewer } from "@/lib/round-viewer";
import { issuesUrl } from "@/lib/tester-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_dashboard/testing/$slug/$n")({
  validateSearch: (search: { compact?: unknown } & SearchSchemaInput): { compact?: true } =>
    isCompact(search) ? { compact: true } : {},
  loader: async ({ context, params }) => {
    const round = await loadRound(context, params);
    await context.queryClient.ensureQueryData(myFeedbackQueryOptions(context.apiClient, round.id));
    return { title: round.title };
  },
  head: ({ loaderData }) => pageHead(loaderData && `Testing · ${loaderData.title}`),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Round not found." backTo="/testing" />,
  component: TesterRoundWorkspace,
});

function popOut() {
  window.open(
    `${window.location.pathname}?compact=1`,
    "feedback-workspace",
    "popup,width=520,height=900",
  );
}

function TesterRoundWorkspace() {
  const params = Route.useParams();
  const { compact } = Route.useSearch();
  const round = useRound(params);
  const viewer = useRoundViewer(round);

  return (
    <PageContainer variant={compact ? "narrow" : "wide"} className={cn(compact && "py-4 sm:py-4")}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {!compact && (
              <Link
                to="/testing"
                aria-label="Back to testing"
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-foreground">{round.title}</h1>
              <p className="font-mono text-xs text-muted-foreground">
                {round.projectSlug} · round {round.projectRoundNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoundStatusBadge status={round.status} />
            {!compact && (
              <Button variant="outline" size="sm" onClick={popOut}>
                <PictureInPicture2 className="h-3.5 w-3.5" />
                Pop out
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/projects/$slug/$n" params={params} target={compact ? "_blank" : undefined}>
                <Eye className="h-3.5 w-3.5" />
                Public page
              </Link>
            </Button>
          </div>
        </header>

        <div className={cn("grid gap-6", !compact && "lg:grid-cols-2")}>
          <RoundBrief round={round} collapsed={!!compact} />
          <section className="min-w-0 space-y-4">
            {viewer.canPost ? (
              <FeedbackComposer roundId={round.id} formats={round.formats} />
            ) : (
              !viewer.participationPending &&
              !viewer.joined && (
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted-foreground">Join this round to give feedback.</p>
                  <Button asChild size="sm">
                    <Link to="/projects/$slug/$n" params={params}>
                      Open round
                    </Link>
                  </Button>
                </Card>
              )
            )}
            <MySubmissions round={round} accountId={viewer.accountId} />
          </section>
        </div>
      </div>
    </PageContainer>
  );
}

function RoundBrief({ round, collapsed }: { round: RoundDetail; collapsed: boolean }) {
  const issues = round.formats.includes("issues") ? issuesUrl(round.repoUrl) : null;
  const readme = round.readme.trim() ? (
    <Markdown content={round.readme} />
  ) : (
    <p className="text-sm text-muted-foreground">The round owner hasn't written a readme yet.</p>
  );

  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-2">
        {round.repoUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={round.repoUrl} target="_blank" rel="noopener noreferrer">
              <GitBranch className="h-3.5 w-3.5" />
              Repository
            </a>
          </Button>
        )}
        {issues && (
          <Button asChild variant="outline" size="sm">
            <a href={issues} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Issues
            </a>
          </Button>
        )}
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {round.closedAt
            ? `Closed ${new Date(round.closedAt).toLocaleDateString()}`
            : `Open since ${new Date(round.createdAt).toLocaleDateString()}`}
        </span>
      </div>
      {collapsed ? (
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Readme</summary>
          <div className="pt-3">{readme}</div>
        </details>
      ) : (
        <Card className="p-5">{readme}</Card>
      )}
    </section>
  );
}

function MySubmissions({ round, accountId }: { round: RoundDetail; accountId: string | null }) {
  const apiClient = useApiClient();
  const { data: mine } = useSuspenseQuery(myFeedbackQueryOptions(apiClient, round.id));

  return (
    <div className="space-y-3" data-testid="my-submissions">
      <SectionHeader
        title="My submissions"
        action={<span className="text-sm text-muted-foreground">{mine.length}</span>}
      />
      {mine.length === 0 ? (
        <EmptyState title="Nothing submitted yet." className="min-h-[12vh]" />
      ) : (
        <FeedbackList
          roundId={round.id}
          entries={mine}
          currentAccountId={accountId}
          canDelete={round.status === "open"}
        />
      )}
    </div>
  );
}
