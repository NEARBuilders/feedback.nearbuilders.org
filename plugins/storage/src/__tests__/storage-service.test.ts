import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PluginIdTag } from "every-plugin";
import { Context, Effect, Layer } from "every-plugin/effect";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseLive } from "../db/layer";
import { StorageLive, type StorageService, StorageTag } from "../services/storage";

const r2 = vi.hoisted(() => ({
  generatePresignedPutUrl: vi.fn(),
  headObject: vi.fn(),
  deleteObject: vi.fn(),
  getPublicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
}));

vi.mock("../r2/client", () => ({
  R2Client: class {
    generatePresignedPutUrl = r2.generatePresignedPutUrl;
    headObject = r2.headObject;
    deleteObject = r2.deleteObject;
    getPublicUrl = r2.getPublicUrl;
  },
}));

const CONFIG = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  bucket: "dev-bucket",
  region: "auto",
  publicUrl: "https://cdn.test",
  accessKeyId: "key",
  secretAccessKey: "secret",
  allowedContentTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  maxUploadBytes: 5 * 1024 * 1024,
};

const UNCONFIGURED = {
  ...CONFIG,
  endpoint: "",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
};

function withService<T>(
  fn: (service: StorageService) => Promise<T>,
  config: typeof CONFIG = CONFIG,
): Promise<T> {
  return Effect.runPromise(
    Effect.gen(function* () {
      const layer = StorageLive(config)
        .pipe(Layer.provide(DatabaseLive(`pglite:${dataDir}`)))
        .pipe(Layer.provide(Layer.succeed(PluginIdTag, "@everything-dev/storage-plugin")));
      const context = yield* Layer.build(layer);
      const service = Context.get(context, StorageTag);
      return yield* Effect.promise(() => fn(service));
    }).pipe(Effect.scoped),
  );
}

let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "storage-plugin-unit-"));
});

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StorageLive", () => {
  // First test of the file: it pays for the cold start of the embedded database.
  it("is configured when the R2 coordinates are present", { timeout: 30_000 }, async () => {
    await withService(async (service) => {
      expect(service.configured).toBe(true);
      await expect(service.ping()).resolves.toMatchObject({
        provider: "r2",
        status: "ok",
        configured: true,
      });
    });
  });

  it("namespaces keys under the uploader's account and never trusts caller keys", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");

    await withService(async (service) => {
      const result = await service.requestUpload({
        uploaderAccountId: "alice.near",
        filename: "screenshot final.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      expect(result.key).toMatch(/^feedback\/alice\.near\/[0-9a-f-]{36}-screenshot_final\.png$/);
      expect(result.presignedUrl).toBe("https://signed.test/put");
      expect(result.publicUrl).toBe(`https://cdn.test/${result.key}`);
      expect(r2.generatePresignedPutUrl).toHaveBeenCalledWith(
        result.key,
        "image/png",
        expect.any(Number),
      );
    });
  });

  it("rejects disallowed content types at request time", async () => {
    await withService(async (service) => {
      await expect(
        service.requestUpload({
          uploaderAccountId: "alice.near",
          filename: "payload.pdf",
          contentType: "application/pdf",
          sizeBytes: 1024,
        }),
      ).rejects.toThrow("Only image uploads are allowed");
      expect(r2.generatePresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  it("rejects oversized uploads at request time", async () => {
    await withService(async (service) => {
      await expect(
        service.requestUpload({
          uploaderAccountId: "alice.near",
          filename: "huge.png",
          contentType: "image/png",
          sizeBytes: 6 * 1024 * 1024,
        }),
      ).rejects.toThrow("exceeds the 5 MB upload limit");
      expect(r2.generatePresignedPutUrl).not.toHaveBeenCalled();
    });
  });

  it("records the actual object size and type at confirm time", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue({ size: 2048, contentType: "image/jpeg" });

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "alice.near",
        filename: "photo.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      const asset = await service.confirmUpload({
        uploaderAccountId: "alice.near",
        key: requested.key,
      });

      expect(asset.status).toBe("confirmed");
      expect(asset.sizeBytes).toBe(2048);
      expect(asset.contentType).toBe("image/jpeg");
      expect(asset.publicUrl).toBe(`https://cdn.test/${requested.key}`);
    });
  });

  it("rejects confirmation when the stored object exceeds the limit", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue({ size: 9 * 1024 * 1024, contentType: "image/png" });
    r2.deleteObject.mockResolvedValue(undefined);

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "alice.near",
        filename: "big.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      await expect(
        service.confirmUpload({ uploaderAccountId: "alice.near", key: requested.key }),
      ).rejects.toThrow("exceeds the 5 MB upload limit");
      expect(r2.deleteObject).toHaveBeenCalledWith(requested.key);
    });
  });

  it("reports not found when nothing was uploaded for the key", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue(null);

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "alice.near",
        filename: "ghost.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      await expect(
        service.confirmUpload({ uploaderAccountId: "alice.near", key: requested.key }),
      ).rejects.toThrow("No object was uploaded for this key");
    });
  });

  it("propagates transient HEAD failures instead of reporting the object missing", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockRejectedValue(new Error("status 500"));

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "alice.near",
        filename: "flaky.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      await expect(
        service.confirmUpload({ uploaderAccountId: "alice.near", key: requested.key }),
      ).rejects.toThrow("status 500");
    });
  });

  it("denies confirm, attach and delete for non-uploaders", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "mallory.near",
        filename: "mine.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });

      await expect(
        service.confirmUpload({ uploaderAccountId: "bob.near", key: requested.key }),
      ).rejects.toThrow("Only the uploader can modify this asset");
      await expect(
        service.attachAsset({
          uploaderAccountId: "bob.near",
          key: requested.key,
          ownerId: "fb-1",
        }),
      ).rejects.toThrow("Only the uploader can modify this asset");
      await expect(
        service.deleteFile({ uploaderAccountId: "bob.near", key: requested.key }),
      ).rejects.toThrow("Only the uploader can modify this asset");
      expect(r2.deleteObject).not.toHaveBeenCalled();
    });
  });

  it("lets the uploader attach an owner reference and delete the asset", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue({ size: 1024, contentType: "image/png" });
    r2.deleteObject.mockResolvedValue(undefined);

    await withService(async (service) => {
      const requested = await service.requestUpload({
        uploaderAccountId: "carol.near",
        filename: "attach.png",
        contentType: "image/png",
        sizeBytes: 1024,
      });
      await service.confirmUpload({ uploaderAccountId: "carol.near", key: requested.key });

      const attached = await service.attachAsset({
        uploaderAccountId: "carol.near",
        key: requested.key,
        ownerId: "feedback-42",
      });
      expect(attached.ownerId).toBe("feedback-42");

      await expect(
        service.deleteFile({ uploaderAccountId: "carol.near", key: requested.key }),
      ).resolves.toEqual({ success: true });
      expect(r2.deleteObject).toHaveBeenCalledWith(requested.key);
      await expect(
        service.deleteFile({ uploaderAccountId: "carol.near", key: requested.key }),
      ).rejects.toThrow("Asset not found");
    });
  });

  it("attaches only the uploader's own assets whose public URL is given", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue({ size: 1024, contentType: "image/png" });
    r2.deleteObject.mockReset();
    r2.deleteObject.mockResolvedValue(undefined);

    await withService(async (service) => {
      const upload = async (account: string, name: string) => {
        const requested = await service.requestUpload({
          uploaderAccountId: account,
          filename: name,
          contentType: "image/png",
          sizeBytes: 1024,
        });
        await service.confirmUpload({ uploaderAccountId: account, key: requested.key });
        return requested;
      };

      const mine = await upload("gina.near", "mine.png");
      const unlisted = await upload("gina.near", "unlisted.png");
      const theirs = await upload("hank.near", "theirs.png");

      await expect(
        service.attachByUrls({
          uploaderAccountId: "gina.near",
          ownerId: "feedback-9",
          urls: [mine.publicUrl, theirs.publicUrl, "https://elsewhere.test/x.png"],
        }),
      ).resolves.toEqual({ attached: 1 });
      await expect(
        service.attachByUrls({ uploaderAccountId: "gina.near", ownerId: "feedback-9", urls: [] }),
      ).resolves.toEqual({ attached: 0 });

      // only the attached asset goes away with its owner
      await expect(
        service.deleteByOwner({ uploaderAccountId: "gina.near", ownerId: "feedback-9" }),
      ).resolves.toEqual({ deleted: 1 });
      expect(r2.deleteObject).toHaveBeenCalledWith(mine.key);
      await expect(
        service.deleteFile({ uploaderAccountId: "gina.near", key: unlisted.key }),
      ).resolves.toEqual({ success: true });
      await expect(
        service.deleteFile({ uploaderAccountId: "hank.near", key: theirs.key }),
      ).resolves.toEqual({ success: true });
    });
  });

  it("deletes only the uploader's own assets attached to an owner", async () => {
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.headObject.mockResolvedValue({ size: 1024, contentType: "image/png" });
    r2.deleteObject.mockReset();
    r2.deleteObject.mockResolvedValue(undefined);

    await withService(async (service) => {
      const upload = async (account: string, owner: string, name: string) => {
        const requested = await service.requestUpload({
          uploaderAccountId: account,
          filename: name,
          contentType: "image/png",
          sizeBytes: 1024,
        });
        await service.confirmUpload({ uploaderAccountId: account, key: requested.key });
        await service.attachAsset({
          uploaderAccountId: account,
          key: requested.key,
          ownerId: owner,
        });
        return requested.key;
      };

      const mine1 = await upload("erin.near", "feedback-owner-1", "a.png");
      const mine2 = await upload("erin.near", "feedback-owner-1", "b.png");
      const otherOwner = await upload("erin.near", "feedback-owner-2", "c.png");
      const someoneElses = await upload("frank.near", "feedback-owner-1", "d.png");

      await expect(
        service.deleteByOwner({ uploaderAccountId: "erin.near", ownerId: "feedback-owner-1" }),
      ).resolves.toEqual({ deleted: 2 });
      expect(r2.deleteObject).toHaveBeenCalledTimes(2);
      expect(r2.deleteObject).toHaveBeenCalledWith(mine1);
      expect(r2.deleteObject).toHaveBeenCalledWith(mine2);

      await expect(
        service.deleteByOwner({ uploaderAccountId: "erin.near", ownerId: "feedback-owner-1" }),
      ).resolves.toEqual({ deleted: 0 });
      await expect(
        service.deleteFile({ uploaderAccountId: "erin.near", key: otherOwner }),
      ).resolves.toEqual({ success: true });
      await expect(
        service.deleteFile({ uploaderAccountId: "frank.near", key: someoneElses }),
      ).resolves.toEqual({ success: true });
    });
  });

  it("stays initialized but rejects writes when unconfigured", async () => {
    await withService(async (service) => {
      expect(service.configured).toBe(false);
      await expect(
        service.requestUpload({
          uploaderAccountId: "alice.near",
          filename: "x.png",
          contentType: "image/png",
          sizeBytes: 1024,
        }),
      ).rejects.toThrow("Storage is not configured");
      await expect(
        service.confirmUpload({ uploaderAccountId: "alice.near", key: "any" }),
      ).rejects.toThrow("Storage is not configured");
    }, UNCONFIGURED);
  });

  it("still resolves ownership on delete when unconfigured, so pending records can be cleaned up", async () => {
    await withService(async (service) => {
      await expect(
        service.deleteFile({ uploaderAccountId: "alice.near", key: "unknown-key" }),
      ).rejects.toThrow("Asset not found");
      expect(r2.deleteObject).not.toHaveBeenCalled();
    }, UNCONFIGURED);
  });
});
