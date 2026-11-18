import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { RouteError, RoutePending } from "@/components/route-states";
import { latestOpenRound } from "@/lib/latest-open-round";
import { pageHead } from "@/lib/page-title";
import { orNotFound } from "@/lib/queries/not-found";
import { projectQueryOptions } from "@/lib/queries/projects";

/**
 * Where the embeddable launcher sends a tester (#294). It resolves the project's latest open
 * round and forwards to that round's send-feedback page, so the host app only needs the
 * project slug. Sign-in, joining and posting all stay on this site, where the session cookie
 * works, instead of inside a cross-site iframe where it would not.
 */
export const Route = createFileRoute("/_public/send/$slug")({
  // `from` and `vp` come from the launcher: the host page address and its window size.
  validateSearch: (search: Record<string, unknown>): { from?: string; vp?: string } => ({
    from: typeof search.from === "string" ? search.from : undefined,
    vp: typeof search.vp === "string" ? search.vp : undefined,
  }),
  loaderDeps: ({ search }) => ({ from: search.from, vp: search.vp }),
  loader: async ({ context, params, deps }) => {
    const project = await orNotFound(
      context.queryClient.ensureQueryData(projectQueryOptions(context.apiClient, params.slug)),
    );
    const round = latestOpenRound(project.rounds);
    if (round) {
      throw redirect({
        to: "/projects/$slug/$n/submit",
        params: { slug: params.slug, n: String(round.projectRoundNumber) },
        search: { from: deps.from, vp: deps.vp },
      });
    }
    return { name: project.name };
  },
  head: () => pageHead("Send feedback"),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: NoOpenRound,
});

function NoOpenRound() {
  const { name } = Route.useLoaderData();
  return (
    <PageContainer variant="default">
      <div className="space-y-3 py-12">
        <h1 className="text-lg font-medium text-foreground">No open feedback round</h1>
        <p className="text-sm text-muted-foreground">
          {name} isn't collecting feedback right now. Check back later, or look at other rounds that
          are open.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/rounds">browse open rounds</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
