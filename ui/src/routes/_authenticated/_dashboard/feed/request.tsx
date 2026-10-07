import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sessionQueryOptions, useApiClient, useAuthClient } from "@/app";
import { Button, Card, Field, FieldLabel, Input, MyProjects } from "@/components";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RoundFieldsEditor } from "@/components/round-fields";
import { pageHead } from "@/lib/page-title";
import { EMPTY_ROUND_FIELDS, roundFieldsComplete, toCreateRoundInput } from "@/lib/round-fields";
import { roundParams } from "@/lib/round-links";
import { useNearAccountStatus } from "@/lib/use-near-account";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export const Route = createFileRoute("/_authenticated/_dashboard/feed/request")({
  head: () => pageHead("Request a round", "Ask builders to test your project and share feedback."),
  component: RequestRoundPage,
});

function RequestRoundPage() {
  const apiClient = useApiClient();
  const auth = useAuthClient();
  const navigate = useNavigate();
  const { accountId: nearAccountId, isDetecting: isNearDetecting } = useNearAccountStatus();
  const sessionQuery = useQuery(sessionQueryOptions(auth));
  const activeOrgId = sessionQuery.data?.session?.activeOrganizationId ?? null;

  const [projectQuery, setProjectQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<{
    id: string;
    slug: string;
    title: string;
  } | null>(null);
  const [showProjectResults, setShowProjectResults] = useState(false);
  const [fields, setFields] = useState(EMPTY_ROUND_FIELDS);

  const debouncedProjectQuery = useDebouncedValue(projectQuery.trim(), 300);
  const searchStatus = useQuery({
    queryKey: ["projectSearchStatus"],
    queryFn: () => apiClient.getProjectSearchStatus(),
    staleTime: 5 * 60 * 1000,
  });
  const searchConfigured = searchStatus.data?.enabled ?? true;
  const projectSearch = useQuery({
    queryKey: ["searchProjects", debouncedProjectQuery],
    queryFn: () => apiClient.searchProjects({ query: debouncedProjectQuery }),
    enabled: searchConfigured && debouncedProjectQuery.length > 1 && !selectedProject,
    staleTime: 30 * 1000,
  });
  const searchUnavailable =
    !searchConfigured || (projectSearch.isSuccess && !projectSearch.data.available);
  const projectResults = selectedProject ? [] : (projectSearch.data?.results ?? []);

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient.createRound({
        projectSlug: selectedProject?.slug ?? projectQuery.trim(),
        projectId: selectedProject?.id,
        projectName: selectedProject?.title,
        ...toCreateRoundInput(fields),
      }),
    onSuccess: (round) => {
      toast.success(
        round.status === "open"
          ? "Round opened"
          : "Project submitted for admin approval; its round opens once approved",
      );
      void navigate({ to: "/projects/$slug/$n", params: roundParams(round) });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    !!nearAccountId && !!activeOrgId && !!projectQuery.trim() && roundFieldsComplete(fields);

  return (
    <PageContainer variant="default">
      <div className="space-y-8">
        <PageHeader
          icon={Sparkles}
          label="Request"
          title="Request a feedback round"
          description="New projects are reviewed by an admin once. After approval, your organization's rounds open right away."
        />

        {!nearAccountId && !isNearDetecting && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Link a NEAR account before requesting a round.{" "}
              <Link to="/settings/auth-methods" className="underline text-foreground">
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
              <Link to="/orgs" className="underline text-foreground">
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
          <Card className="p-6 space-y-4">
            <Field>
              <FieldLabel htmlFor="round-project">project</FieldLabel>
              <div className="relative">
                <Input
                  id="round-project"
                  value={projectQuery}
                  onChange={(e) => {
                    setProjectQuery(e.target.value);
                    setSelectedProject(null);
                    setShowProjectResults(true);
                  }}
                  onFocus={() => setShowProjectResults(true)}
                  onBlur={() => setTimeout(() => setShowProjectResults(false), 150)}
                  placeholder={
                    searchConfigured
                      ? "Search nearbuilders.org projects, or type a new slug"
                      : "Type a project slug"
                  }
                  autoComplete="off"
                  required
                  disabled={createMutation.isPending}
                />
                {showProjectResults && projectResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-md">
                    {projectResults.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedProject(project);
                          setProjectQuery(project.title);
                          setShowProjectResults(false);
                        }}
                      >
                        <span className="font-medium text-foreground">{project.title}</span>
                        <span className="text-xs text-muted-foreground">{project.slug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProject ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked to nearbuilders.org project "{selectedProject.slug}".
                </p>
              ) : searchUnavailable ? (
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  data-testid="project-search-unavailable"
                >
                  {searchConfigured
                    ? "Project search is unavailable right now"
                    : "Project search is unavailable"}
                  {projectQuery.trim()
                    ? " — this will be stored as a free-text slug."
                    : " — enter a slug to use as a free-text project."}
                </p>
              ) : (
                projectQuery.trim().length > 1 &&
                !projectSearch.isFetching && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No match on nearbuilders.org — this will be stored as a free-text slug.
                  </p>
                )
              )}
            </Field>

            <RoundFieldsEditor
              value={fields}
              onChange={setFields}
              disabled={createMutation.isPending}
            />
          </Card>

          <Button type="submit" disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? "Requesting..." : "Request round"}
          </Button>
        </form>

        <MyProjects />
      </div>
    </PageContainer>
  );
}
