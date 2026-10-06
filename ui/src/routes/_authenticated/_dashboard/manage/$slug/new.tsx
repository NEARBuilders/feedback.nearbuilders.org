import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, type SearchSchemaInput, useNavigate } from "@tanstack/react-router";
import { PlusCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundFieldsEditor } from "@/components/round-fields";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import {
  loadProject,
  type ProjectDetail,
  requireProjectManager,
  useProject,
} from "@/lib/project-route";
import { invalidateProjectQueries } from "@/lib/queries/projects";
import { invalidateRoundQueries, roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { nextRoundFields, roundFieldsComplete, toCreateRoundInput } from "@/lib/round-fields";
import { parseRoundNumber, roundParams } from "@/lib/round-links";
import type { RoundDetail } from "@/lib/round-route";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/new")({
  validateSearch: (search: { from?: number } & SearchSchemaInput): { from?: number } => {
    const from = parseRoundNumber(String(search.from));
    return from ? { from } : {};
  },
  beforeLoad: async ({ context, params }) => {
    await requireProjectManager(context, params.slug);
  },
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: async ({ context, params, deps }) => {
    const project = await loadProject(context, params.slug);
    if (deps.from) {
      await context.queryClient.prefetchQuery(
        roundBySlugQueryOptions(context.apiClient, params.slug, deps.from),
      );
    }
    return { name: project.name };
  },
  head: ({ loaderData }) => pageHead(loaderData && `New round · ${loaderData.name}`),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Project not found." backTo="/manage" />,
  component: NewRoundPage,
});

function NewRoundPage() {
  const { slug } = Route.useParams();
  const { from } = Route.useSearch();
  const project = useProject(slug);
  const apiClient = useApiClient();
  const previousQuery = useQuery({
    ...roundBySlugQueryOptions(apiClient, slug, from ?? 0),
    enabled: !!from,
  });

  if (from && previousQuery.isPending) return <RoutePending />;

  return (
    <NewRoundForm
      key={previousQuery.data?.id ?? "blank"}
      project={project}
      previous={previousQuery.data ?? null}
    />
  );
}

function NewRoundForm({
  project,
  previous,
}: {
  project: ProjectDetail;
  previous: RoundDetail | null;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [fields, setFields] = useState(() => nextRoundFields(previous));
  const [created, setCreated] = useState<{ id: string; slug: string; n: string } | null>(null);

  const openConsole = (params: { slug: string; n: string }) =>
    void navigate({ to: "/manage/$slug/$n", params });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createRound({
        projectSlug: project.slug,
        projectName: project.name,
        ...toCreateRoundInput(fields),
      }),
    onSuccess: (round) => {
      void invalidateRoundQueries(queryClient);
      void invalidateProjectQueries(queryClient);
      toast.success(`Round ${round.projectRoundNumber} opened`);
      const params = roundParams(round);
      if (previous && round.status === "open") setCreated({ id: round.id, ...params });
      else openConsole(params);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: (round: { id: string }) =>
      apiClient.inviteTesters({ id: round.id, fromRoundId: previous?.id ?? "" }),
    onSuccess: ({ recipients }) => {
      toast.success(`Invited ${recipients} ${recipients === 1 ? "tester" : "testers"}`);
      if (created) openConsole(created);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <PageContainer variant="narrow">
      <div className="space-y-8">
        <PageHeader
          icon={PlusCircle}
          label={project.name}
          title="Start a round"
          description={
            previous
              ? `Prefilled from round ${previous.projectRoundNumber}. Change anything before you start.`
              : undefined
          }
        />

        {created ? (
          <Card className="p-6 space-y-4">
            <p className="text-sm text-foreground">
              Round {created.n} is open. Invite the testers from round{" "}
              {previous?.projectRoundNumber}?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => inviteMutation.mutate(created)}
                disabled={inviteMutation.isPending}
              >
                <Send className="h-4 w-4" />
                invite previous testers
              </Button>
              <Button variant="outline" onClick={() => openConsole(created)}>
                skip
              </Button>
            </div>
          </Card>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-6"
          >
            <Card className="p-6 space-y-4">
              <RoundFieldsEditor
                value={fields}
                onChange={setFields}
                disabled={createMutation.isPending}
              />
            </Card>
            <Button
              type="submit"
              disabled={!roundFieldsComplete(fields) || createMutation.isPending}
            >
              {createMutation.isPending ? "starting..." : "start round"}
            </Button>
          </form>
        )}
      </div>
    </PageContainer>
  );
}
