import type { PluginsClient } from "../lib/plugins-types.gen";

type StorageClientFactory = PluginsClient["storage"];

interface AssetsLogger {
  warn(message: string): void;
}

export interface FeedbackAssets {
  /**
   * Links the images in a feedback body to the feedback, so they can be removed with it.
   * Best effort: a failure is logged and never blocks posting.
   */
  attachForFeedback(feedback: {
    id: string;
    authorAccountId: string;
    body: string | null;
  }): Promise<void>;
  /**
   * Deletes the images attached to removed feedback. Assets belong to whoever uploaded them,
   * so the storage plugin is called as the feedback's author, whoever removed it. Best
   * effort: a failure is logged and never blocks the removal.
   */
  deleteForFeedback(feedback: { id: string; authorAccountId: string | null }): Promise<void>;
  /**
   * Links a round's banner image to the round, so it can be removed with it. Assets belong
   * to the round owner, so the storage plugin is called as them. Best effort: a failure is
   * logged and never blocks the save.
   */
  attachRoundBanner(banner: {
    roundId: string;
    ownerAccountId: string;
    bannerUrl: string | null;
  }): Promise<void>;
  /** Deletes the banner image attached to a deleted round. Best effort. */
  deleteRoundBanner(banner: { roundId: string; ownerAccountId: string | null }): Promise<void>;
}

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;

/** The image URLs in a markdown body, in order, without duplicates. */
export function imageUrlsIn(body: string | null | undefined): string[] {
  if (!body) return [];
  const urls = new Set<string>();
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    if (match[1]) urls.add(match[1]);
  }
  return [...urls];
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
  const failed = (action: string, id: string, error: unknown) =>
    logger.warn(
      `[storage] couldn't ${action} the images of feedback ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );

  return {
    attachForFeedback: async (feedback) => {
      const urls = imageUrlsIn(feedback.body);
      if (!storage || urls.length === 0) return;
      try {
        await storage(asAccount(feedback.authorAccountId)).attachByUrls({
          ownerId: feedback.id,
          urls,
        });
      } catch (error) {
        failed("attach", feedback.id, error);
      }
    },

    deleteForFeedback: async (feedback) => {
      // Anonymous feedback has no uploader to act as, and no attached assets (#89).
      if (!storage || !feedback.authorAccountId) return;
      try {
        await storage(asAccount(feedback.authorAccountId)).deleteByOwner({
          ownerId: feedback.id,
        });
      } catch (error) {
        failed("delete", feedback.id, error);
      }
    },

    attachRoundBanner: async (banner) => {
      if (!storage || !banner.bannerUrl || !banner.ownerAccountId) return;
      try {
        await storage(asAccount(banner.ownerAccountId)).attachByUrls({
          ownerId: banner.roundId,
          urls: [banner.bannerUrl],
        });
      } catch (error) {
        failed("attach the banner of", banner.roundId, error);
      }
    },

    deleteRoundBanner: async (banner) => {
      if (!storage || !banner.ownerAccountId) return;
      try {
        await storage(asAccount(banner.ownerAccountId)).deleteByOwner({
          ownerId: banner.roundId,
        });
      } catch (error) {
        failed("delete the banner of", banner.roundId, error);
      }
    },
  };
}
