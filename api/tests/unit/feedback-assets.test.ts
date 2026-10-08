import { describe, expect, it, vi } from "vitest";
import { createFeedbackAssets, imageUrlsIn } from "@/services/feedback-assets";

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

describe("createFeedbackAssets", () => {
  const warn = vi.fn();

  it("attaches a body's images as the author and skips bodies without any", async () => {
    const attachByUrls = vi.fn().mockResolvedValue({ attached: 1 });
    const storage = vi.fn().mockReturnValue({ attachByUrls });
    const assets = createFeedbackAssets(storage, { warn });

    await assets.attachForFeedback({ id: "f1", authorAccountId: "a.near", body: "x" });
    expect(storage).not.toHaveBeenCalled();

    await assets.attachForFeedback({
      id: "f1",
      authorAccountId: "a.near",
      body: "![s](https://cdn.test/s.png)",
    });
    expect(storage).toHaveBeenCalledWith(
      expect.objectContaining({ near: expect.objectContaining({ primaryAccountId: "a.near" }) }),
    );
    expect(attachByUrls).toHaveBeenCalledWith({ ownerId: "f1", urls: ["https://cdn.test/s.png"] });
  });

  it("deletes as the author, and does nothing for anonymous feedback", async () => {
    const deleteByOwner = vi.fn().mockResolvedValue({ deleted: 1 });
    const storage = vi.fn().mockReturnValue({ deleteByOwner });
    const assets = createFeedbackAssets(storage, { warn });

    await assets.deleteForFeedback({ id: "f2", authorAccountId: null });
    expect(storage).not.toHaveBeenCalled();

    await assets.deleteForFeedback({ id: "f2", authorAccountId: "b.near" });
    expect(deleteByOwner).toHaveBeenCalledWith({ ownerId: "f2" });
  });

  it("logs instead of throwing when the storage plugin fails, and works without one", async () => {
    const storage = vi.fn().mockReturnValue({
      attachByUrls: vi.fn().mockRejectedValue(new Error("down")),
      deleteByOwner: vi.fn().mockRejectedValue(new Error("down")),
    });
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
