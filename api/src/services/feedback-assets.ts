import type { PluginsClient } from "../lib/plugins-types.gen";

type StorageClientFactory = PluginsClient["storage"];

interface AssetsLogger {
  warn(message: string): void;
}

export interface FeedbackAssets {
  /**
   * Deletes the images attached to removed feedback (#108). Assets belong to whoever uploaded
   * them, so the storage plugin is called as the feedback's author, whoever removed it. Best
   * effort: a failed cleanup is logged and never blocks the removal.
   */
  deleteForFeedback(feedback: { id: string; authorAccountId: string }): Promise<void>;
}

function asAccount(accountId: string): Record<string, unknown> {
  return {
    near: {
      primaryAccountId: accountId,
      hasNearAccount: true,
      linkedAccounts: [{ accountId, network: "mainnet", publicKey: "", isPrimary: true }],
    },
  };
}

export function createFeedbackAssets(
  storage: StorageClientFactory | undefined,
  logger: AssetsLogger = console,
): FeedbackAssets {
  return {
    deleteForFeedback: async (feedback) => {
      if (!storage) return;
      try {
        await storage(asAccount(feedback.authorAccountId)).deleteByOwner({
          ownerId: feedback.id,
        });
      } catch (error) {
        logger.warn(
          `[storage] couldn't delete the images of feedback ${feedback.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  };
}
