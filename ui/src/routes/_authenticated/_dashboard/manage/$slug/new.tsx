import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, type SearchSchemaInput, useNavigate } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Card } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundFieldsEditor } from "@/components/round-fields";
import { RouteError, RouteNotFound, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { loadProject, requireProjectManager } from "@/lib/project-route";
import { invalidateProjectQueries } from "@/lib/queries/projects";
import { invalidateRoundQueries, roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { nextRoundFields, roundFieldsComplete, toCreateRoundInput } from "@/lib/round-fields";
import { roundParams } from "@/lib/round-links";
import { positiveInt } from "@/lib/search";

export const Route = createFileRoute("/_authenticated/_dashboard/manage/$slug/new")({
  validateSearch: (search: { from?: number } & SearchSchemaInput): { from?: number } => {
    const from = positiveInt(search.from);
    return from ? { from } : {};
  },
  beforeLoad: async ({ context, params }) => {
    await requireProjectManager(context, params.slug);
  },
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: async ({ context, params, deps }) => {
    const project = await loadProject(context, params.slug);
    const previous = deps.from
      ? await context.queryClient
          .ensureQueryData(roundBySlugQueryOptions(context.apiClient, params.slug, deps.from))
          .catch(() => null)
      : null;
    return { project, previous };
  },
  head: ({ loaderData }) => pageHead(loaderData && `New round · ${loaderData.project.name}`),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound title="Project not found." backTo="/manage" />,
  component: NewRoundPage,
});

function NewRoundPage() {
  const { project, previous } = Route.useLoaderData();
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [fields, setFields] = useState(() => nextRoundFields(previous));

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
      toast.success(`Round ${round.projectRoundNumber} started`);
      void navigate({
        to: previous ? "/manage/$slug/$n/broadcast" : "/manage/$slug/$n",
        params: roundParams(round),
      });
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
              : "Testers see the title, description and readme while they test."
          }
        />
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
          <Button type="submit" disabled={!roundFieldsComplete(fields) || createMutation.isPending}>
            {createMutation.isPending ? "starting..." : "start round"}
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}
