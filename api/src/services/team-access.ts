import type { PluginsClient } from "../lib/plugins-types.gen";

type AuthClientFactory = PluginsClient["auth"];

interface TeamAccessLogger {
  warn(message: string): void;
}

export interface TeamAccess {
  /** Whether the auth plugin is available to answer team questions. */
  readonly enabled: boolean;
  /** Fails closed: any lookup error counts as "not a member". */
  isMember(context: Record<string, unknown>, teamId: string, userId: string): Promise<boolean>;
  /** The ids of the teams in an organization, or null when they could not be read. */
  listOrgTeamIds(
    context: Record<string, unknown>,
    organizationId: string,
  ): Promise<string[] | null>;
}

export function createTeamAccess(
  auth: AuthClientFactory | undefined,
  logger: TeamAccessLogger = console,
): TeamAccess {
  return {
    enabled: typeof auth === "function",

    isMember: async (context, teamId, userId) => {
      if (!auth) return false;
      try {
        const members = await auth(context).listTeamMembers({ teamId });
        return members.some((member) => member.userId === userId);
      } catch (error) {
        logger.warn(
          `[teams] membership lookup for team ${teamId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return false;
      }
    },

    listOrgTeamIds: async (context, organizationId) => {
      if (!auth) return null;
      try {
        const teams = await auth(context).listTeams({ organizationId });
        return teams.map((team) => team.id);
      } catch (error) {
        logger.warn(
          `[teams] listing teams for organization ${organizationId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    },
  };
}
