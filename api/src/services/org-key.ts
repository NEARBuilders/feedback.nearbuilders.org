export interface OrganizationPrincipal {
  type?: string | null;
  organizationId?: string | null;
}

export interface OrgKeyContext {
  principal?: OrganizationPrincipal | null;
  apiKey?: unknown;
}

/**
 * The organization an organization API key (`org_…`) belongs to, or null for any other caller
 * (#111). An org key is the organization's own credential: it reads every round and all
 * feedback, private included, of projects that organization owns, bypassing team delegation
 * (only org owners and admins can mint one). It never writes, and personal `api_…` keys are
 * not covered.
 */
export function orgKeyOrganizationId(context: OrgKeyContext): string | null {
  if (!context.apiKey) return null;
  const principal = context.principal;
  if (principal?.type !== "organization" || !principal.organizationId) return null;
  return principal.organizationId;
}
