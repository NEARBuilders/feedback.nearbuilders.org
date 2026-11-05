import { describe, expect, it, vi } from "vitest";
import { createFeedbackAssets, imageUrlsIn, uploaderAccountsIn } from "@/services/feedback-assets";

describe("imageUrlsIn", () => {
  it("finds markdown image URLs once each, in order", () => {
    const body = [
      "Broken ![a](https://cdn.test/a.png) and ![b](https://cdn.test/b.png 'title')",
      "![a again](https://cdn.test/a.png)",
      "![](<https://cdn.test/c.png>)",
    ].join("\n");
    expect(imageUrlsIn(body)).toEqual([
      "https://cdn.test/a.png",
      "https://cdn.test/b.png",
      "https://cdn.test/c.png",
    ]);
  });

  it("ignores plain links, empty bodies and non-images", () => {
    expect(imageUrlsIn("[link](https://x.test) and https://y.test/z.png")).toEqual([]);
    expect(imageUrlsIn(null)).toEqual([]);
    expect(imageUrlsIn("")).toEqual([]);
  });
});

describe("uploaderAccountsIn", () => {
  it("reads the uploader account from storage keys and skips anything else", () => {
    expect(
      uploaderAccountsIn([
        "https://cdn.test/feedback/alice.near/1-a.png",
        "https://cdn.test/bucket/feedback/bob.near/2-b.png",
        "https://cdn.test/feedback/alice.near/3-c.png",
        "https://cdn.test/img/a.png",
        "https://cdn.test/feedback/%E0%A4%A/4-d.png",
        "not a url",
        null,
      ]),
    ).toEqual(["alice.near", "bob.near"]);
  });
});

describe("createFeedbackAssets", () => {
  const warn = vi.fn();

  it("attaches a body's images as the author and skips bodies without any", async () => {
    const attachByUrls = vi.fn().mockResolvedValue({ attached: 1 });
    const clientContext = vi.fn().mockReturnValue({ attachByUrls });
    const storage = { client: clientContext };
    const assets = createFeedbackAssets(storage, { warn });

    await assets.attachForFeedback({ id: "f1", authorAccountId: "a.near", body: "x" });
    expect(clientContext).not.toHaveBeenCalled();

    await assets.attachForFeedback({
      id: "f1",
      authorAccountId: "a.near",
      body: "![s](https://cdn.test/s.png)",
    });
    expect(clientContext).toHaveBeenCalledWith(
      expect.objectContaining({ near: expect.objectContaining({ primaryAccountId: "a.near" }) }),
    );
    expect(attachByUrls).toHaveBeenCalledWith({ ownerId: "f1", urls: ["https://cdn.test/s.png"] });
  });

  it("deletes as the author, and does nothing for anonymous feedback", async () => {
    const deleteByOwner = vi.fn().mockResolvedValue({ deleted: 1 });
    const storage = { client: vi.fn().mockReturnValue({ deleteByOwner }) };
    const assets = createFeedbackAssets(storage, { warn });

    await assets.deleteForFeedback({ id: "f2", authorAccountId: null });
    expect(deleteByOwner).not.toHaveBeenCalled();

    await assets.deleteForFeedback({ id: "f2", authorAccountId: "b.near" });
    expect(deleteByOwner).toHaveBeenCalledWith({ ownerId: "f2" });
  });

  it("acts as the author's linked accounts too when they are known (#224)", async () => {
    const attachByUrls = vi.fn().mockResolvedValue({ attached: 1 });
    const clientContext = vi.fn().mockReturnValue({ attachByUrls });
    const assets = createFeedbackAssets({ client: clientContext }, { warn });

    await assets.attachForFeedback({
      id: "f3",
      authorAccountId: "a.near",
      body: "![s](https://cdn.test/s.png)",
      linkedAccountIds: ["a-new.near", "a.near"],
    });
    expect(clientContext).toHaveBeenCalledWith({
      near: {
        primaryAccountId: "a.near",
        hasNearAccount: true,
        linkedAccounts: [
          { accountId: "a.near", network: "mainnet", publicKey: "", isPrimary: true },
          { accountId: "a-new.near", network: "mainnet", publicKey: "", isPrimary: false },
        ],
      },
    });
  });

  it("deletes as the uploaders named in the body's image URLs too (#224)", async () => {
    const deleteByOwner = vi.fn().mockResolvedValue({ deleted: 1 });
    const clientContext = vi.fn().mockReturnValue({ deleteByOwner });
    const assets = createFeedbackAssets({ client: clientContext }, { warn });

    await assets.deleteForFeedback({
      id: "f5",
      authorAccountId: "a.near",
      body: "![s](https://cdn.test/feedback/a-old.near/1-s.png)",
      linkedAccountIds: ["owner.near"],
    });
    expect(deleteByOwner).toHaveBeenCalledWith({ ownerId: "f5" });
    const near = clientContext.mock.calls[0]?.[0].near;
    expect(near.primaryAccountId).toBe("a.near");
    expect(near.linkedAccounts.map((a: { accountId: string }) => a.accountId)).toEqual([
      "a.near",
      "owner.near",
      "a-old.near",
    ]);
  });

  it("attaches a banner as its uploader and deletes it as the URL's uploader too (#224)", async () => {
    const attachByUrls = vi.fn().mockResolvedValue({ attached: 1 });
    const deleteByOwner = vi.fn().mockResolvedValue({ deleted: 1 });
    const clientContext = vi.fn().mockReturnValue({ attachByUrls, deleteByOwner });
    const assets = createFeedbackAssets({ client: clientContext }, { warn });
    const bannerUrl = "https://cdn.test/feedback/manager.near/1-banner.png";

    await assets.attachRoundBanner({ roundId: "r1", uploaderAccountId: "manager.near", bannerUrl });
    expect(attachByUrls).toHaveBeenCalledWith({ ownerId: "r1", urls: [bannerUrl] });
    expect(clientContext.mock.calls[0]?.[0].near.primaryAccountId).toBe("manager.near");

    await assets.deleteRoundBanner({ roundId: "r1", ownerAccountId: "owner.near", bannerUrl });
    expect(deleteByOwner).toHaveBeenCalledWith({ ownerId: "r1" });
    const near = clientContext.mock.calls[1]?.[0].near;
    expect(near.primaryAccountId).toBe("owner.near");
    expect(near.linkedAccounts.map((a: { accountId: string }) => a.accountId)).toEqual([
      "owner.near",
      "manager.near",
    ]);
  });

  it("logs instead of throwing when the storage plugin fails, and works without one", async () => {
    const storage = {
      client: () => ({
        attachByUrls: vi.fn().mockRejectedValue(new Error("down")),
        deleteByOwner: vi.fn().mockRejectedValue(new Error("down")),
      }),
    } as never;
    const assets = createFeedbackAssets(storage, { warn });

    await expect(
      assets.attachForFeedback({
        id: "f3",
        authorAccountId: "c.near",
        body: "![s](https://c.test/s.png)",
      }),
    ).resolves.toBeUndefined();
    await expect(
      assets.deleteForFeedback({ id: "f3", authorAccountId: "c.near" }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);

    const none = createFeedbackAssets(undefined, { warn });
    await expect(
      none.deleteForFeedback({ id: "f4", authorAccountId: "d.near" }),
    ).resolves.toBeUndefined();
  });
});
