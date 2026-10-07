import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import {
  Badge,
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  SectionHeader,
  Skeleton,
} from "@/components";
import { invalidateProjectQueries, projectsQueryOptions } from "@/lib/queries/projects";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import { roundParams } from "@/lib/round-links";

export const Route = createFileRoute("/_admin/_dashboard/admin/projects")({
  head: () => ({
    meta: [{ title: "Project approvals | Admin" }],
  }),
  component: ProjectApprovalsPage,
});

function ProjectApprovalsPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const pendingQuery = useQuery(projectsQueryOptions(apiClient, "pending"));

  const invalidate = () => {
    void invalidateProjectQueries(queryClient);
    void invalidateRoundQueries(queryClient);
  };

  const projects = pendingQuery.data ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader title="Project approvals" />
      {pendingQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects are waiting for review.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <PendingProjectCard key={project.id} project={project} onDecided={invalidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingProjectCard({
  project,
  onDecided,
}: {
  project: {
    id: string;
    slug: string;
    name: string;
    ownerOrgId: string | null;
    createdAt: string;
    rounds: Array<{ id: string; title: string; status: string; projectRoundNumber: number }>;
  };
  onDecided: () => void;
}) {
  const apiClient = useApiClient();
  const [reason, setReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: () => apiClient.approveProject({ id: project.id }),
    onSuccess: () => {
      toast.success(`Approved "${project.name}"`);
      onDecided();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => apiClient.rejectProject({ id: project.id, reason: reason.trim() }),
    onSuccess: () => {
      toast.success(`Rejected "${project.name}"`);
      onDecided();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{project.name}</p>
        <p className="text-xs font-mono text-muted-foreground">
          {project.slug} · {project.ownerOrgId ?? "no owning org yet"}
        </p>
      </div>

      {project.rounds.length > 0 && (
        <ul className="space-y-1">
          {project.rounds.map((round) => (
            <li key={round.id} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-[10px]">
                {round.status}
              </Badge>
              <Link
                to="/projects/$slug/$n"
                params={roundParams({ ...round, projectSlug: project.slug })}
                className="text-foreground underline"
              >
                #{round.projectRoundNumber} {round.title}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Field>
        <FieldLabel htmlFor={`reject-reason-${project.id}`}>rejection reason (required)</FieldLabel>
        <Input
          id={`reject-reason-${project.id}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why isn't this ready?"
          disabled={pending}
        />
      </Field>

      <div className="flex gap-2">
        <Button onClick={() => approveMutation.mutate()} disabled={pending}>
          {approveMutation.isPending ? "Approving..." : "Approve"}
        </Button>
        <Button
          variant="outline"
          onClick={() => rejectMutation.mutate()}
          disabled={pending || !reason.trim()}
        >
          {rejectMutation.isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </Card>
  );
}
