import { MARKDOWN_IMAGE } from "../lib/feedback-body";
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
    linkedAccountIds?: readonly string[];
  }): Promise<void>;
  /**
   * Deletes the images attached to removed feedback. Assets belong to whoever uploaded them,
   * so the storage plugin is called as the feedback's author, whoever removed it, plus the
   * uploader accounts named in the body's image URLs (#224). Only assets already attached to
   * this feedback are ever deleted. Best effort: a failure is logged and never blocks the
   * removal.
   */
  deleteForFeedback(feedback: {
    id: string;
    authorAccountId: string | null;
    body?: string | null;
    linkedAccountIds?: readonly string[];
  }): Promise<void>;
  /**
   * Links a round's banner image to the round, so it can be removed with it. Assets belong
   * to whoever uploaded them, so the storage plugin is called as the uploader: the caller
   * who set the banner, which may be a round manager rather than the owner (#224). Best
   * effort: a failure is logged and never blocks the save.
   */
  attachRoundBanner(banner: {
    roundId: string;
    uploaderAccountId: string;
    bannerUrl: string | null;
    linkedAccountIds?: readonly string[];
  }): Promise<void>;
  /**
   * Deletes the banner image attached to a round, acting as the owner plus the uploader
   * account named in the banner URL (#224), so a banner a round manager uploaded goes too.
   * Only assets already attached to this round are ever deleted. Best effort.
   */
  deleteRoundBanner(banner: {
    roundId: string;
    ownerAccountId: string | null;
    bannerUrl?: string | null;
    linkedAccountIds?: readonly string[];
  }): Promise<void>;
}

/** The image URLs in a markdown body, in order, without duplicates. */
export function imageUrlsIn(body: string | null | undefined): string[] {
  if (!body) return [];
  const urls = new Set<string>();
  for (const match of body.matchAll(MARKDOWN_IMAGE)) {
    if (match[2]) urls.add(match[2]);
  }
  return [...urls];
}

/**
 * The uploader accounts named in storage URLs: keys are `feedback/<uploader>/<file>`. Only
 * used to widen a delete-by-owner, which never touches assets not already attached to that
 * owner, so a URL naming someone else's account can't reach their other files.
 */
export function uploaderAccountsIn(urls: readonly (string | null | undefined)[]): string[] {
  const accounts = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }
    const match = /\/feedback\/([^/]+)\/[^/]+$/.exec(path);
    if (!match?.[1]) continue;
    try {
      accounts.add(decodeURIComponent(match[1]));
    } catch {
      // A malformed escape can't name a real uploader; skip it rather than fail the cleanup.
    }
  }
  return [...accounts];
}

/**
 * A storage context acting as `accountId`. `linkedAccountIds` (the acting user's other
 * accounts, when known) let it reach assets uploaded under any of them (#224).
 */
function asAccount(
  accountId: string,
  linkedAccountIds?: readonly string[],
): Record<string, unknown> {
  const ids = [...new Set([accountId, ...(linkedAccountIds ?? [])])];
  return {
    near: {
      primaryAccountId: accountId,
      hasNearAccount: true,
      linkedAccounts: ids.map((id) => ({
        accountId: id,
        network: "mainnet",
        publicKey: "",
        isPrimary: id === accountId,
      })),
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
        await storage
          .client(asAccount(feedback.authorAccountId, feedback.linkedAccountIds))
          .attachByUrls({
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
        await storage
          .client(
            asAccount(feedback.authorAccountId, [
              ...(feedback.linkedAccountIds ?? []),
              ...uploaderAccountsIn(imageUrlsIn(feedback.body)),
            ]),
          )
          .deleteByOwner({
            ownerId: feedback.id,
          });
      } catch (error) {
        failed("delete", feedback.id, error);
      }
    },

    attachRoundBanner: async (banner) => {
      if (!storage || !banner.bannerUrl || !banner.uploaderAccountId) return;
      try {
        await storage
          .client(asAccount(banner.uploaderAccountId, banner.linkedAccountIds))
          .attachByUrls({
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
        await storage
          .client(
            asAccount(banner.ownerAccountId, [
              ...(banner.linkedAccountIds ?? []),
              ...uploaderAccountsIn([banner.bannerUrl]),
            ]),
          )
          .deleteByOwner({
            ownerId: banner.roundId,
          });
      } catch (error) {
        failed("delete the banner of", banner.roundId, error);
      }
    },
  };
}
