import { ORPCError } from "@orpc/server";
import { Context, Effect, Layer } from "effect";
import { buildScoped, createPlugin } from "every-plugin";
import { z } from "zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { StorageLive, type StorageService, StorageTag } from "./services/storage";

export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type StorageRuntimeShape = { storage: StorageService };

class StorageRuntimeTag extends Context.Service<StorageRuntimeTag, StorageRuntimeShape>()(
  "StorageRuntime",
) {}

let runtime: StorageRuntimeShape | undefined;

const getRuntime = (): StorageRuntimeShape => {
  if (!runtime) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Storage services not initialized" });
  }
  return runtime;
};

export default createPlugin({
  variables: z.object({
    allowedContentTypes: z.array(z.string()).default([...DEFAULT_ALLOWED_CONTENT_TYPES]),
    maxUploadBytes: z.number().int().positive().default(DEFAULT_MAX_UPLOAD_BYTES),
  }),

  secrets: z.object({
    STORAGE_DATABASE_URL: z.string().default("pglite:.bos/storage/:memory:"),
    STORAGE_ENDPOINT: z.string().default(""),
    STORAGE_BUCKET: z.string().default(""),
    STORAGE_REGION: z.string().default("auto"),
    STORAGE_PUBLIC_URL: z.string().default(""),
    STORAGE_ACCESS_KEY_ID: z.string().default(""),
    STORAGE_SECRET_ACCESS_KEY: z.string().default(""),
  }),

  context: ContextSchema,

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config);
      const Storage = StorageLive({
        endpoint: config.secrets.STORAGE_ENDPOINT,
        bucket: config.secrets.STORAGE_BUCKET,
        region: config.secrets.STORAGE_REGION,
        publicUrl: config.secrets.STORAGE_PUBLIC_URL,
        accessKeyId: config.secrets.STORAGE_ACCESS_KEY_ID,
        secretAccessKey: config.secrets.STORAGE_SECRET_ACCESS_KEY,
        allowedContentTypes: config.variables.allowedContentTypes,
        maxUploadBytes: config.variables.maxUploadBytes,
      }).pipe(Layer.provide(Database));

      const storage = yield* buildScoped(StorageTag, Storage);

      console.log(
        `[Storage] Initialized (bucket: ${config.secrets.STORAGE_BUCKET || "not configured"}, max upload: ${config.variables.maxUploadBytes} bytes)`,
      );

      runtime = { storage };
      return Layer.succeed(StorageRuntimeTag, { storage });
    }),

  createRouter: (builder) => {
    const requireNearAccount = builder.middleware(async ({ context, next }) => {
      if (!context.near?.primaryAccountId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "NEAR wallet required",
          data: {
            authType: "near",
            hint: "Link a NEAR wallet to manage uploads",
          },
        });
      }
      return next({ context: { uploaderAccountId: context.near.primaryAccountId } });
    });

    return {
      ping: builder.ping.handler(async () => {
        return await getRuntime().storage.ping();
      }),

      requestUpload: builder.requestUpload
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await getRuntime().storage.requestUpload({
            uploaderAccountId: context.uploaderAccountId,
            filename: input.filename,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
          });
        }),

      confirmUpload: builder.confirmUpload
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await getRuntime().storage.confirmUpload({
            uploaderAccountId: context.uploaderAccountId,
            key: input.key,
          });
        }),

      attachAsset: builder.attachAsset
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await getRuntime().storage.attachAsset({
            uploaderAccountId: context.uploaderAccountId,
            key: input.key,
            ownerId: input.ownerId,
          });
        }),

      attachByUrls: builder.attachByUrls
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await getRuntime().storage.attachByUrls({
            uploaderAccountId: context.uploaderAccountId,
            ownerId: input.ownerId,
            urls: input.urls,
          });
        }),

      deleteByOwner: builder.deleteByOwner
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await getRuntime().storage.deleteByOwner({
            uploaderAccountId: context.uploaderAccountId,
            ownerId: input.ownerId,
          });
        }),

      deleteFile: builder.deleteFile.use(requireNearAccount).handler(async ({ input, context }) => {
        return await getRuntime().storage.deleteFile({
          uploaderAccountId: context.uploaderAccountId,
          key: input.key,
        });
      }),
    };
  },
});
