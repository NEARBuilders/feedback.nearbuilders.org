import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, type SearchSchemaInput, useNavigate } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button, Card, Field, FieldLabel, Input, MyProjects } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundFieldsEditor } from "@/components/round-fields";
import { RouteError, RoutePending } from "@/components/route-states";
import { pageHead } from "@/lib/page-title";
import { loadProject } from "@/lib/project-route";
import { invalidateProjectQueries } from "@/lib/queries/projects";
import { invalidateRoundQueries, roundBySlugQueryOptions } from "@/lib/queries/rounds";
import { nextRoundFields, roundFieldsComplete, toCreateRoundInput } from "@/lib/round-fields";
import { roundParams } from "@/lib/round-links";
import { positiveInt } from "@/lib/search";
import { useNearAccountStatus } from "@/lib/use-near-account";

interface NewRoundSearch {
  /** Preselects the project, skipping the picker. */
  project?: string;
  /** Round number to prefill from, for "run this one again". */
  from?: number;
}

/**
 * The single place a round is created.
 *
 * Requesting a round for a new project and starting the next round on one you
 * already own are the same action with the same fields; they only differ in
 * whether the project is already known. `?project=` decides that, instead of
 * two routes maintaining two copies of the form.
 */
export const Route = createFileRoute("/_authenticated/_dashboard/manage/new")({
  validateSearch: (search: Partial<NewRoundSearch> & SearchSchemaInput): NewRoundSearch => {
    const from = positiveInt(search.from);
    return {
      ...(typeof search.project === "string" && search.project ? { project: search.project } : {}),
      ...(from ? { from } : {}),
    };
  },
  loaderDeps: ({ search }) => ({ project: search.project, from: search.from }),
  loader: async ({ context, deps }) => {
    if (!deps.project) return { project: null, previous: null };
    const project = await loadProject(context, deps.project);
    const previous = deps.from
      ? await context.queryClient
          .ensureQueryData(roundBySlugQueryOptions(context.apiClient, deps.project, deps.from))
          .catch(() => null)
      : null;
    return { project, previous };
  },
  head: ({ loaderData }) =>
    pageHead(
      loaderData?.project ? `New round · ${loaderData.project.name}` : "Request a round",
      "Ask builders to test your project and share feedback.",
    ),
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: NewRoundPage,
});

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function NewRoundPage() {
  const { project, previous } = Route.useLoaderData();
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { accountId: nearAccountId, isDetecting: isNearDetecting } = useNearAccountStatus();
  const sessionQuery = useQuery(sessionQueryOptions(auth));
  const activeOrgId = sessionQuery.data?.session?.activeOrganizationId ?? null;

  // The picker's raw text doubles as the slug when the registry has no match,
  // so it lives here rather than inside the picker.
  const [projectQuery, setProjectQuery] = useState("");
  const [picked, setPicked] = useState<{ id: string; slug: string; title: string } | null>(null);
  const [fields, setFields] = useState(() => nextRoundFields(previous));

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createRound({
        projectSlug: project?.slug ?? picked?.slug ?? projectQuery.trim(),
        projectId: picked?.id,
        projectName: project?.name ?? picked?.title,
        ...toCreateRoundInput(fields),
      }),
    onSuccess: (round) => {
      void invalidateRoundQueries(queryClient);
      void invalidateProjectQueries(queryClient);
      toast.success(
        round.status === "open"
          ? `Round ${round.projectRoundNumber} opened`
          : "Project submitted for admin approval; its round opens once approved",
      );
      void navigate({
        // Straight to broadcast when this round was cloned from a previous one:
        // the testers to invite are already known.
        to: previous ? "/manage/$slug/$n/broadcast" : "/projects/$slug/$n",
        params: roundParams(round),
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasProject = !!project || !!picked || !!projectQuery.trim();
  const canSubmit = !!nearAccountId && !!activeOrgId && hasProject && roundFieldsComplete(fields);

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <PageHeader
          icon={PlusCircle}
          label={project ? project.name : "Request"}
          title={project ? "Start a round" : "Request a feedback round"}
          description={
            previous
              ? `Prefilled from round ${previous.projectRoundNumber}. Change anything before you start.`
              : project
                ? "Testers see the title, description and readme while they test."
                : "New projects are reviewed by an admin once. After approval, your organization's rounds open right away."
          }
        />

        {!nearAccountId && !isNearDetecting && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Link a NEAR account before requesting a round.{" "}
              <Link to="/settings/auth-methods" className="text-foreground underline">
                Link one now
              </Link>
              .
            </p>
          </Card>
        )}

        {!activeOrgId && !sessionQuery.isLoading && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Rounds belong to an organization. Select or create an organization before requesting
              one.{" "}
              <Link to="/orgs" className="text-foreground underline">
                Open organizations
              </Link>
              .
            </p>
          </Card>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-6"
        >
          <Card className="space-y-4 p-6">
            {!project && (
              <ProjectPicker
                query={projectQuery}
                onQueryChange={setProjectQuery}
                picked={picked}
                onPick={setPicked}
                disabled={createMutation.isPending}
              />
            )}
            <RoundFieldsEditor
              value={fields}
              onChange={setFields}
              disabled={createMutation.isPending}
            />
          </Card>

          <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending
              ? project
                ? "starting..."
                : "Requesting..."
              : project
                ? "start round"
                : "Request round"}
          </Button>
        </form>

        {!project && <MyProjects />}
      </div>
    </PageContainer>
  );
}

interface ProjectPickerProps {
  query: string;
  onQueryChange: (query: string) => void;
  picked: { id: string; slug: string; title: string } | null;
  onPick: (project: { id: string; slug: string; title: string } | null) => void;
  disabled: boolean;
}

/**
 * Typeahead over the nearbuilders.org registry, degrading to a free-text slug
 * when the registry is unreachable so a round can still be requested.
 */
function ProjectPicker({ query, onQueryChange, picked, onPick, disabled }: ProjectPickerProps) {
  const apiClient = useApiClient();
  const [showResults, setShowResults] = useState(false);
  const debounced = useDebouncedValue(query.trim(), 300);

  const searchStatus = useQuery({
    queryKey: ["projectSearchStatus"],
    queryFn: () => apiClient.getProjectSearchStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const configured = searchStatus.data?.enabled ?? true;
  const search = useQuery({
    queryKey: ["searchProjects", debounced],
    queryFn: () => apiClient.searchProjects({ query: debounced }),
    enabled: configured && debounced.length > 1 && !picked,
    staleTime: 30 * 1000,
  });
  const unavailable = !configured || (search.isSuccess && !search.data.available);
  const results = picked ? [] : (search.data?.results ?? []);

  return (
    <Field>
      <FieldLabel htmlFor="round-project">project</FieldLabel>
      <div className="relative">
        <Input
          id="round-project"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            onPick(null);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder={
            configured
              ? "Search nearbuilders.org projects, or type a new slug"
              : "Type a project slug"
          }
          autoComplete="off"
          required
          disabled={disabled}
        />
        {showResults && results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(result);
                  onQueryChange(result.title);
                  setShowResults(false);
                }}
              >
                <span className="font-medium text-foreground">{result.title}</span>
                <span className="text-xs text-muted-foreground">
                  {result.domain ?? result.slug}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {picked ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Linked to nearbuilders.org project "{picked.slug}".
        </p>
      ) : unavailable ? (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="project-search-unavailable">
          {configured ? "Project search is unavailable right now" : "Project search is unavailable"}
          {query.trim()
            ? " — this will be stored as a free-text slug."
            : " — enter a slug to use as a free-text project."}
        </p>
      ) : (
        query.trim().length > 1 &&
        !search.isFetching && (
          <p className="mt-1 text-xs text-muted-foreground">
            No match on nearbuilders.org — this will be stored as a free-text slug.
          </p>
        )
      )}
    </Field>
  );
}
