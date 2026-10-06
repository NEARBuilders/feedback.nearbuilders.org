import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRuntime } from "every-plugin";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import Plugin from "../index";

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

function nearContext(accountId: string) {
  return {
    near: {
      primaryAccountId: accountId,
      hasNearAccount: true,
      linkedAccounts: [
        { accountId, network: "mainnet", publicKey: "ed25519:test", isPrimary: true },
      ],
    },
  };
}

describe("Storage plugin", () => {
  const runtime = createPluginRuntime({
    registry: { storage: { module: Plugin } },
  });

  let dataDir: string;
  let loaded: Awaited<ReturnType<typeof runtime.usePlugin<"storage">>>;

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "storage-plugin-integration-"));
    loaded = await runtime.usePlugin("storage", {
      variables: {
        allowedContentTypes: ["image/png", "image/jpeg"],
        maxUploadBytes: 1024 * 1024,
      },
      secrets: {
        STORAGE_DATABASE_URL: `pglite:${dataDir}`,
        STORAGE_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        STORAGE_BUCKET: "dev-bucket",
        STORAGE_REGION: "auto",
        STORAGE_PUBLIC_URL: "https://cdn.test",
        STORAGE_ACCESS_KEY_ID: "key",
        STORAGE_SECRET_ACCESS_KEY: "secret",
      },
    });
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.deleteObject.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await runtime.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    r2.generatePresignedPutUrl.mockResolvedValue("https://signed.test/put");
    r2.deleteObject.mockResolvedValue(undefined);
  });

  it("exposes configuration status through ping", async () => {
    const client = loaded.createClient();
    await expect(client.ping()).resolves.toMatchObject({
      provider: "r2",
      status: "ok",
      configured: true,
    });
  });

  it("rejects every write procedure without a NEAR account", async () => {
    const client = loaded.createClient();
    await expect(
      client.requestUpload({
        filename: "a.png",
        contentType: "image/png",
        sizeBytes: 1024,
      }),
    ).rejects.toThrow("NEAR wallet required");
    await expect(client.confirmUpload({ key: "feedback/x/1-a.png" })).rejects.toThrow(
      "NEAR wallet required",
    );
    await expect(
      client.attachAsset({ key: "feedback/x/1-a.png", ownerId: "fb-1" }),
    ).rejects.toThrow("NEAR wallet required");
    await expect(client.deleteFile({ key: "feedback/x/1-a.png" })).rejects.toThrow(
      "NEAR wallet required",
    );
    expect(r2.generatePresignedPutUrl).not.toHaveBeenCalled();
  });

  it("issues presigned uploads under the caller's namespace", async () => {
    const client = loaded.createClient(nearContext("alice.near"));
    const result = await client.requestUpload({
      filename: "Screen Shot 2026.png",
      contentType: "image/png",
      sizeBytes: 2048,
    });

    expect(result.key).toMatch(/^feedback\/alice\.near\/[0-9a-f-]{36}-Screen_Shot_2026\.png$/);
    expect(result.presignedUrl).toBe("https://signed.test/put");
    expect(r2.generatePresignedPutUrl).toHaveBeenCalledWith(result.key, "image/png", 3600);
  });

  it("rejects disallowed types and oversized files", async () => {
    const client = loaded.createClient(nearContext("limits.near"));
    await expect(
      client.requestUpload({ filename: "doc.pdf", contentType: "application/pdf", sizeBytes: 10 }),
    ).rejects.toThrow("Only image uploads are allowed");
    await expect(
      client.requestUpload({
        filename: "big.png",
        contentType: "image/png",
        sizeBytes: 2 * 1024 * 1024,
      }),
    ).rejects.toThrow("upload limit");
  });

  it("confirms uploads with the stored object's metadata and blocks non-uploaders", async () => {
    r2.headObject.mockResolvedValue({ size: 4096, contentType: "image/png" });
    const alice = loaded.createClient(nearContext("confirm-alice.near"));
    const requested = await alice.requestUpload({
      filename: "confirm.png",
      contentType: "image/png",
      sizeBytes: 1024,
    });

    const bob = loaded.createClient(nearContext("confirm-bob.near"));
    await expect(bob.confirmUpload({ key: requested.key })).rejects.toThrow(
      "Only the uploader can modify this asset",
    );

    const asset = await alice.confirmUpload({ key: requested.key });
    expect(asset).toMatchObject({
      key: requested.key,
      status: "confirmed",
      sizeBytes: 4096,
      contentType: "image/png",
      publicUrl: `https://cdn.test/${requested.key}`,
    });
  });

  it("lets only the uploader attach an owner and delete the asset", async () => {
    r2.headObject.mockResolvedValue({ size: 128, contentType: "image/png" });
    const carol = loaded.createClient(nearContext("delete-carol.near"));
    const requested = await carol.requestUpload({
      filename: "gone.png",
      contentType: "image/png",
      sizeBytes: 128,
    });
    await carol.confirmUpload({ key: requested.key });

    const attached = await carol.attachAsset({ key: requested.key, ownerId: "feedback-7" });
    expect(attached.ownerId).toBe("feedback-7");

    const dave = loaded.createClient(nearContext("delete-dave.near"));
    await expect(dave.deleteFile({ key: requested.key })).rejects.toThrow(
      "Only the uploader can modify this asset",
    );

    await expect(carol.deleteFile({ key: requested.key })).resolves.toEqual({ success: true });
    expect(r2.deleteObject).toHaveBeenCalledWith(requested.key);
  });
});
