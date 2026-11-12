import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApiClient } from "@/app";
import { Button, Input } from "@/components";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { invalidateProjectQueries } from "@/lib/queries/projects";

interface PartnerEntry {
  organizationId: string;
  slug: string | null;
}

interface ProjectPartnersProps {
  projectId: string;
  partners: PartnerEntry[];
  canManagePartners: boolean;
}

export function ProjectPartners({ projectId, partners, canManagePartners }: ProjectPartnersProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");
  const [removing, setRemoving] = useState<PartnerEntry | null>(null);

  const addMutation = useMutation({
    mutationFn: () => apiClient.addProjectPartner({ id: projectId, organizationSlug: slug.trim() }),
    onSuccess: (project) => {
      setSlug("");
      void invalidateProjectQueries(queryClient);
      const added = project.partners.at(-1);
      toast.success(added?.slug ? `Added partner @${added.slug}` : "Partner added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (target: PartnerEntry) =>
      apiClient.removeProjectPartner({
        id: projectId,
        organizationSlug: target.slug ?? target.organizationId,
      }),
    onSuccess: () => {
      setRemoving(null);
      void invalidateProjectQueries(queryClient);
      toast.success("Partner removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canManagePartners) return null;

  const submit = () => {
    if (slug.trim() && !addMutation.isPending) addMutation.mutate();
  };

  return (
    <section className="space-y-3" data-testid="project-partners">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">Partners</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Partner organizations co-manage every round of this project, private feedback included.
      </p>
      {partners.length > 0 ? (
        <ul className="space-y-2" data-testid="project-partners-list">
          {partners.map((partner) => (
            <li
              key={partner.organizationId}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span className="text-sm text-foreground break-all">
                @{partner.slug ?? partner.organizationId}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoving(partner)}
                data-testid={`project-partners-remove-${partner.slug ?? partner.organizationId}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="project-partners-empty">
          No partners yet.
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="organization slug, e.g. nearlytrade"
          data-testid="project-partners-slug"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={!slug.trim() || addMutation.isPending}
        >
          {addMutation.isPending ? "adding…" : "add partner"}
        </Button>
      </form>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title={`Remove partner @${removing?.slug ?? ""}?`}
        description="Their members immediately lose access to this project's rounds."
        confirmLabel="Remove partner"
        variant="destructive"
        isPending={removeMutation.isPending}
        onConfirm={() => removing && removeMutation.mutate(removing)}
      />
    </section>
  );
}
