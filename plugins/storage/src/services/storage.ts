import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { DatabaseTag } from "../db/layer";
import { type AssetStatus, assetStatus, storageAssets } from "../db/schema";
import { R2Client, type StoredObjectHead } from "../r2/client";

export interface StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  publicUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  allowedContentTypes: readonly string[];
  maxUploadBytes: number;
}

export interface AssetRecord {
  id: string;
  key: string;
  publicUrl: string;
  uploaderAccountId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  ownerId: string | null;
  status: AssetStatus;
  createdAt: string;
}

export interface UploadRequestResult {
  presignedUrl: string;
  assetId: string;
  publicUrl: string;
  key: string;
}

export interface StorageService {
  readonly configured: boolean;
  ping(): Promise<{ provider: string; status: "ok"; configured: boolean; timestamp: string }>;
  requestUpload(input: {
    uploaderAccountId: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<UploadRequestResult>;
  confirmUpload(input: { uploaderAccountId: string; key: string }): Promise<AssetRecord>;
  attachAsset(input: {
    uploaderAccountId: string;
    key: string;
    ownerId: string;
  }): Promise<AssetRecord>;
  deleteFile(input: { uploaderAccountId: string; key: string }): Promise<{ success: boolean }>;
  /** Attaches the uploader's own assets whose public URL is in `urls` to `ownerId`. */
  attachByUrls(input: {
    uploaderAccountId: string;
    ownerId: string;
    urls: string[];
  }): Promise<{ attached: number }>;
  /** Deletes the uploader's own assets attached to `ownerId`; others' assets are never touched. */
  deleteByOwner(input: {
    uploaderAccountId: string;
    ownerId: string;
  }): Promise<{ deleted: number }>;
}

export class StorageTag extends Context.Tag("Storage")<StorageTag, StorageService>() {}

function sanitizeFilename(filename: string): string {
  const cleaned = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned.slice(-128) : "upload";
}

function toRecord(row: typeof storageAssets.$inferSelect, publicUrl: string): AssetRecord {
  return {
    id: row.id,
    key: row.key,
    publicUrl: `${publicUrl}/${row.key}`,
    uploaderAccountId: row.uploaderAccountId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    ownerId: row.ownerId,
    status: row.status,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

export const StorageLive = (config: StorageConfig) =>
  Layer.effect(
    StorageTag,
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      const configured = Boolean(
        config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey,
      );

      const r2 = configured
        ? new R2Client({
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            bucket: config.bucket,
            endpoint: config.endpoint,
            region: config.region,
            publicUrl: config.publicUrl || undefined,
          })
        : null;

      function requireR2(): R2Client {
        if (!r2) {
          throw new ORPCError("SERVICE_UNAVAILABLE", {
            message: "Storage is not configured",
            data: {
              hint: "Set STORAGE_ENDPOINT, STORAGE_BUCKET and the R2 access key secrets to enable uploads",
            },
          });
        }
        return r2;
      }

      function assertAllowedType(contentType: string): string {
        const normalized = contentType.trim().toLowerCase();
        if (!config.allowedContentTypes.includes(normalized)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Only image uploads are allowed",
            data: { contentType: normalized, allowed: config.allowedContentTypes },
          });
        }
        return normalized;
      }

      function assertAllowedSize(sizeBytes: number): void {
        if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
          throw new ORPCError("BAD_REQUEST", { message: "File size must be a positive integer" });
        }
        if (sizeBytes > config.maxUploadBytes) {
          throw new ORPCError("BAD_REQUEST", {
            message: `File exceeds the ${Math.floor(config.maxUploadBytes / (1024 * 1024))} MB upload limit`,
            data: { sizeBytes, maxUploadBytes: config.maxUploadBytes },
          });
        }
      }

      async function resolveOwnedAsset(
        uploaderAccountId: string,
        key: string,
      ): Promise<typeof storageAssets.$inferSelect> {
        const [row] = await db
          .select()
          .from(storageAssets)
          .where(eq(storageAssets.key, key))
          .limit(1);
        if (!row) {
          throw new ORPCError("NOT_FOUND", {
            message: "Asset not found",
            data: { resource: "asset", resourceId: key },
          });
        }
        if (row.uploaderAccountId !== uploaderAccountId) {
          throw new ORPCError("FORBIDDEN", {
            message: "Only the uploader can modify this asset",
          });
        }
        return row;
      }

      const publicUrlBase = (config.publicUrl || `${config.endpoint}/${config.bucket}`).replace(
        /\/$/,
        "",
      );

      const service: StorageService = {
        configured,

        ping: async () => ({
          provider: "r2",
          status: "ok" as const,
          configured,
          timestamp: new Date().toISOString(),
        }),

        requestUpload: async (input) => {
          const client = requireR2();
          const contentType = assertAllowedType(input.contentType);
          assertAllowedSize(input.sizeBytes);

          const key = `feedback/${input.uploaderAccountId}/${crypto.randomUUID()}-${sanitizeFilename(input.filename)}`;
          const id = crypto.randomUUID();

          await db.insert(storageAssets).values({
            id,
            key,
            uploaderAccountId: input.uploaderAccountId,
            filename: sanitizeFilename(input.filename),
            contentType,
            sizeBytes: input.sizeBytes,
            status: assetStatus.pending,
          });

          try {
            const presignedUrl = await client.generatePresignedPutUrl(key, contentType, 3600);
            return {
              presignedUrl,
              assetId: id,
              publicUrl: client.getPublicUrl(key),
              key,
            };
          } catch (error) {
            await db.delete(storageAssets).where(eq(storageAssets.id, id));
            throw new ORPCError("SERVICE_UNAVAILABLE", {
              message: `Failed to generate presigned upload URL: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
          }
        },

        confirmUpload: async (input) => {
          const client = requireR2();
          const row = await resolveOwnedAsset(input.uploaderAccountId, input.key);

          const head: StoredObjectHead | null = await client.headObject(input.key);
          if (!head) {
            await db
              .delete(storageAssets)
              .where(and(eq(storageAssets.key, input.key), eq(storageAssets.id, row.id)));
            throw new ORPCError("NOT_FOUND", {
              message: "No object was uploaded for this key",
              data: { resource: "asset", resourceId: input.key },
            });
          }

          let actualType: string;
          try {
            assertAllowedSize(head.size);
            actualType = assertAllowedType(head.contentType ?? row.contentType);
          } catch (error) {
            await client.deleteObject(input.key).catch(() => undefined);
            await db.delete(storageAssets).where(eq(storageAssets.id, row.id));
            throw error;
          }

          const [updated] = await db
            .update(storageAssets)
            .set({ sizeBytes: head.size, contentType: actualType, status: assetStatus.confirmed })
            .where(eq(storageAssets.id, row.id))
            .returning();

          if (!updated) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "Failed to confirm the asset record",
            });
          }
          return toRecord(updated, publicUrlBase);
        },

        attachAsset: async (input) => {
          const row = await resolveOwnedAsset(input.uploaderAccountId, input.key);
          const [updated] = await db
            .update(storageAssets)
            .set({ ownerId: input.ownerId })
            .where(eq(storageAssets.id, row.id))
            .returning();
          if (!updated) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "Failed to attach the asset",
            });
          }
          return toRecord(updated, publicUrlBase);
        },

        deleteFile: async (input) => {
          const row = await resolveOwnedAsset(input.uploaderAccountId, input.key);

          if (r2) await r2.deleteObject(input.key);
          await db.delete(storageAssets).where(eq(storageAssets.id, row.id));
          return { success: true };
        },

        attachByUrls: async (input) => {
          if (input.urls.length === 0) return { attached: 0 };
          const wanted = new Set(input.urls);
          const rows = await db
            .select()
            .from(storageAssets)
            .where(eq(storageAssets.uploaderAccountId, input.uploaderAccountId));
          const matching = rows.filter((row) => wanted.has(`${publicUrlBase}/${row.key}`));
          for (const row of matching) {
            await db
              .update(storageAssets)
              .set({ ownerId: input.ownerId })
              .where(eq(storageAssets.id, row.id));
          }
          return { attached: matching.length };
        },

        deleteByOwner: async (input) => {
          const rows = await db
            .select()
            .from(storageAssets)
            .where(
              and(
                eq(storageAssets.ownerId, input.ownerId),
                eq(storageAssets.uploaderAccountId, input.uploaderAccountId),
              ),
            );
          for (const row of rows) {
            if (r2) await r2.deleteObject(row.key);
            await db.delete(storageAssets).where(eq(storageAssets.id, row.id));
          }
          return { deleted: rows.length };
        },
      };

      return service;
    }),
  );
