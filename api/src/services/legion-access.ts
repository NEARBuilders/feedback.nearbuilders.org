import type { PluginsClient } from "../lib/plugins-types.gen";

type LegionClientFactory = PluginsClient["legion"];

interface LegionAccessLogger {
  warn(message: string): void;
}

export interface LegionAccessResult {
  hasAccess: boolean;
  linkedNearAccount: string | null;
  mintUrl: string;
}

export interface LegionAccess {
  /** Fails closed: any lookup error counts as "no access" (#128). */
  getMyAccess(
    context: Record<string, unknown>,
    nearAccountId: string | null,
  ): Promise<LegionAccessResult>;
  /**
   * Access across every account the caller linked (#224): the first holder wins, so the hint
   * names the account that qualifies. With none, reports the primary (first) account as denied.
   */
  getMyAccessAcross(
    context: Record<string, unknown>,
    nearAccountIds: string[],
  ): Promise<LegionAccessResult>;
}

export const LEGION_MINT_URL = "https://nearlegion.com/mint";

export function createLegionAccess(
  legion: LegionClientFactory | undefined,
  logger: LegionAccessLogger = console,
): LegionAccess {
  const denied = (accountId: string | null): LegionAccessResult => ({
    hasAccess: false,
    linkedNearAccount: accountId,
    mintUrl: LEGION_MINT_URL,
  });

  const service: LegionAccess = {
    getMyAccess: async (context, nearAccountId) => {
      if (!nearAccountId) return denied(null);
      if (!legion) return denied(nearAccountId);
      try {
        const { hasAccess } = await legion.client(context).checkAccess({
          nearAccountId,
        });
        return {
          hasAccess,
          linkedNearAccount: nearAccountId,
          mintUrl: LEGION_MINT_URL,
        };
      } catch (error) {
        logger.warn(
          `[legion] access check for ${nearAccountId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return denied(nearAccountId);
      }
    },
    getMyAccessAcross: async (context, nearAccountIds) => {
      let first: LegionAccessResult | null = null;
      for (const accountId of nearAccountIds) {
        const result = await service.getMyAccess(context, accountId);
        if (result.hasAccess) return result;
        first ??= result;
      }
      return first ?? denied(null);
    },
  };
  return service;
}
