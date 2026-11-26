import type { PluginsClient } from "../lib/plugins-types.gen";

type AuthClientFactory = PluginsClient["auth"];

interface OrgMembershipLogger {
  warn(message: string): void;
}

/**
 * Whether the caller belongs to any of the given organizations. `unverifiable` keeps the
 * fail-closed case distinct from a definitive "no", so an auth-plugin outage refuses the
 * action with a retryable message instead of letting an org member through (#291).
 */
export type OrgMembership = "member" | "not-member" | "unverifiable";

export interface OrgMembershipAccess {
  checkMembership(
    context: Record<string, unknown>,
    organizationIds: string[],
  ): Promise<OrgMembership>;
}

/**
 * Looks up the caller's membership in specific organizations through the shared auth plugin,
 * independent of which organization is active in their session. A returned member only counts
 * when it belongs to the organization that was asked about, so a lookup that ignores the
 * requested organization and answers for the session's active one can't flag every caller
 * with some active organization as a member of the running org.
 */
export function createOrgMembershipAccess(
  auth: AuthClientFactory | undefined,
  logger: OrgMembershipLogger = console,
): OrgMembershipAccess {
  return {
    checkMembership: async (context, organizationIds) => {
      if (organizationIds.length === 0) return "not-member";
      if (!auth) return "unverifiable";
      try {
        const client = auth.client(context);
        const members = await Promise.all(
          organizationIds.map(async (organizationId) => {
            const member: { id: string | null; organizationId?: string | null } | null | undefined =
              await client.getActiveMember({ organizationId });
            return !!member?.id && member.organizationId === organizationId;
          }),
        );
        return members.some(Boolean) ? "member" : "not-member";
      } catch (error) {
        logger.warn(
          `[orgs] membership lookup failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return "unverifiable";
      }
    },
  };
}
