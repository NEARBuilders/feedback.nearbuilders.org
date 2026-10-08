import { ExternalLink, GitBranch, Globe } from "lucide-react";
import { Button } from "@/components";
import type { ProjectDetail } from "@/lib/project-route";
import { cn } from "@/lib/utils";

type Identity = ProjectDetail["identity"];

/**
 * A project's identity comes from the nearbuilders.org registry, which owns it.
 * `identity` is null when the registry has no entry or is unreachable, so every
 * surface here degrades to the local name and slug rather than showing nothing.
 */

/** The registry stores domains bare or with a scheme; both views come from one. */
function normalizeDomain(domain: string): { url: string; label: string } {
  return {
    url: /^https?:\/\//i.test(domain) ? domain : `https://${domain}`,
    label: domain.replace(/^https?:\/\//i, "").replace(/\/+$/, ""),
  };
}

export function projectDomainUrl(identity: Identity): string | null {
  return identity?.domain ? normalizeDomain(identity.domain).url : null;
}

export function projectDomainLabel(identity: Identity): string | null {
  return identity?.domain ? normalizeDomain(identity.domain).label : null;
}

export function nearBuildersUrl(identity: Identity, slug: string): string {
  return `https://nearbuilders.org/projects/${identity?.kind ?? "project"}/${slug}`;
}

interface ProjectAvatarProps {
  identity: Identity;
  name: string;
  className?: string;
}

export function ProjectAvatar({ identity, name, className }: ProjectAvatarProps) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs font-semibold text-muted-foreground",
        className ?? "h-9 w-9",
      )}
    >
      {identity?.logoUrl ? (
        <img src={identity.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials
      )}
    </div>
  );
}

/**
 * The primary call to action on anything testable: a round is useless to a
 * tester who cannot reach the product, so this outranks the repository link.
 */
export function ProductLink({
  identity,
  size = "sm",
}: {
  identity: Identity;
  size?: "sm" | "default";
}) {
  const url = projectDomainUrl(identity);
  if (!url) return null;
  return (
    <Button asChild size={size}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Globe className="h-3.5 w-3.5" />
        open the product
      </a>
    </Button>
  );
}

export function ProjectLinks({ identity, slug }: { identity: Identity; slug: string }) {
  const repository = identity?.repository;
  return (
    <>
      {repository && (
        <Button asChild variant="outline" size="sm">
          <a href={repository} target="_blank" rel="noopener noreferrer">
            <GitBranch className="h-3.5 w-3.5" />
            repository
          </a>
        </Button>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={nearBuildersUrl(identity, slug)} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          nearbuilders.org
        </a>
      </Button>
    </>
  );
}

/** Compact name + domain pairing, for rows in a list of projects or rounds. */
export function ProjectLabel({
  identity,
  name,
  className,
}: {
  identity: Identity;
  name: string;
  className?: string;
}) {
  const domain = projectDomainLabel(identity);
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <ProjectAvatar identity={identity} name={name} className="h-6 w-6 text-[10px]" />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{name}</span>
        {domain && <span className="block truncate text-xs text-muted-foreground">{domain}</span>}
      </span>
    </span>
  );
}
