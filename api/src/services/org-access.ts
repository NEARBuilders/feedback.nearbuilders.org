import type { PluginsClient } from "../lib/plugins-types.gen";

type AuthClientFactory = PluginsClient["auth"];

interface OrgAccessLogger {
  warn(message: string): void;
}

export interface ResolvedOrganization {
  organizationId: string;
  slug: string;
  status: "active" | "pending" | "rejected";
}

/**
 * What an org-slug lookup concluded. `unverifiable` keeps the fail-closed case
 * distinct from "unknown org": the caller gets a retryable refusal instead of a
 * definitive no, so an auth-plugin outage never locks partners out by mistake.
 */
export type OrgResolution = ResolvedOrganization | null | "unverifiable";

export interface OrgAccess {
  resolveBySlug(context: Record<string, unknown>, slug: string): Promise<OrgResolution>;
}

/**
 * Resolves an organization by slug against the shared auth plugin, for guards
 * that need to know an org exists and is active (partner management, #279).
 * Orgs are public-by-default in the family, so a signed-in caller can list
 * them; every failure still fails closed.
 */
export function createOrgAccess(
  auth: AuthClientFactory | undefined,
  logger: OrgAccessLogger = console,
): OrgAccess {
  return {
    resolveBySlug: async (context, slug) => {
      if (!auth) return "unverifiable";
      try {
        const organizations = await auth.client(context).listOrganizations();
        const match = organizations.find(
          (organization: { slug: string }) => organization.slug === slug,
        );
        if (!match) return null;
        return { organizationId: match.id, slug: match.slug, status: match.status };
      } catch (error) {
        logger.warn(
          `[orgs] lookup for slug ${slug} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return "unverifiable";
      }
    },
  };
}
