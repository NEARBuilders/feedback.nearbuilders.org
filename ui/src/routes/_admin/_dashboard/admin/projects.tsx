import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { type ApiClient, useApiClient } from "@/app";
import {
  Badge,
  Button,
  Card,
  Field,
  FieldLabel,
  Input,
  SectionHeader,
  SegmentedToggle,
  Skeleton,
  VerifiedBadge,
} from "@/components";
import { AccountAvatar } from "@/components/account-avatar";
import { TelegramHandle } from "@/components/tip-tester";
import { invalidateProjectQueries, projectsQueryOptions } from "@/lib/queries/projects";
import { invalidateRoundQueries } from "@/lib/queries/rounds";
import { roundParams } from "@/lib/round-links";

type AdminProject = Awaited<ReturnType<ApiClient["listProjects"]>>[number];

export const Route = createFileRoute("/_admin/_dashboard/admin/projects")({
  head: () => ({
    meta: [{ title: "Project approvals | Admin" }],
  }),
  component: ProjectApprovalsPage,
});

function ProjectApprovalsPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved">("pending");

  const projectsQuery = useQuery(projectsQueryOptions(apiClient, status));

  const invalidate = () => {
    void invalidateProjectQueries(queryClient);
    void invalidateRoundQueries(queryClient);
  };

  const projects = projectsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader title="Project approvals" />
      <SegmentedToggle
        ariaLabel="Project status"
        value={status}
        onValueChange={setStatus}
        options={[
          { value: "pending", label: "pending" },
          { value: "approved", label: "approved" },
        ]}
      />
      {projectsQuery.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {status === "pending"
            ? "No projects are waiting for review."
            : "No approved projects yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <ProjectReviewCard key={project.id} project={project} onDecided={invalidate} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The wallet behind the project: its most recent round's owner. */
function RequesterRow({ requesterAccountId }: { requesterAccountId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex items-center gap-2">
        <AccountAvatar accountId={requesterAccountId} className="h-6 w-6" />
        <Link
          to="/$accountId"
          params={{ accountId: requesterAccountId }}
          className="font-mono text-xs text-foreground underline"
        >
          {requesterAccountId}
        </Link>
      </div>
      <TelegramHandle accountId={requesterAccountId} enabled />
    </div>
  );
}

function ProjectReviewCard({
  project,
  onDecided,
}: {
  project: AdminProject;
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

  const verifyMutation = useMutation({
    mutationFn: () =>
      project.verifiedAt
        ? apiClient.unverifyProject({ id: project.id })
        : apiClient.verifyProject({ id: project.id }),
    onSuccess: () => {
      toast.success(
        project.verifiedAt ? `Unverified "${project.name}"` : `Verified "${project.name}"`,
      );
      onDecided();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pending = approveMutation.isPending || rejectMutation.isPending || verifyMutation.isPending;

  const requesterAccountId = project.rounds.at(-1)?.ownerAccountId ?? null;
  const identity = project.identity;

  return (
    <Card className="p-4 space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{project.name}</p>
          {project.verifiedAt && <VerifiedBadge />}
        </div>
        <p className="text-xs font-mono text-muted-foreground">{project.slug}</p>
        {project.contact && (
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground">contact:</span>{" "}
            <span className="font-mono">{project.contact}</span>
          </p>
        )}
      </div>

      {requesterAccountId && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">requested by</p>
          <RequesterRow requesterAccountId={requesterAccountId} />
        </div>
      )}

      {identity && (identity.domain || identity.repository) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {identity.domain && (
            <a
              href={`https://${identity.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline hover:text-foreground"
            >
              {identity.domain}
            </a>
          )}
          {identity.repository && (
            <a
              href={identity.repository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline hover:text-foreground"
            >
              repository
            </a>
          )}
        </div>
      )}

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

      {project.status === "pending" && (
        <>
          <Field>
            <FieldLabel htmlFor={`reject-reason-${project.id}`}>
              rejection reason (required)
            </FieldLabel>
            <Input
              id={`reject-reason-${project.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why isn't this ready?"
              disabled={pending}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
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
            <Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={pending}>
              {verifyMutation.isPending
                ? project.verifiedAt
                  ? "Unverifying..."
                  : "Verifying..."
                : project.verifiedAt
                  ? "Unverify"
                  : "Verify"}
            </Button>
          </div>
        </>
      )}

      {project.status === "approved" && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => verifyMutation.mutate()} disabled={pending}>
            {verifyMutation.isPending
              ? project.verifiedAt
                ? "Unverifying..."
                : "Verifying..."
              : project.verifiedAt
                ? "Unverify"
                : "Verify"}
          </Button>
        </div>
      )}
    </Card>
  );
}
