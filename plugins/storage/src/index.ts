import { createPlugin } from "every-plugin";
import { Effect, Layer } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive } from "./db/layer";
import { ContextSchema } from "./lib/context";
import { StorageLive, StorageTag } from "./services/storage";

export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

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

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const Database = DatabaseLive(config.secrets.STORAGE_DATABASE_URL);
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

      const storage = yield* tools.buildService(StorageTag, Storage);

      console.log(
        `[Storage] Initialized (bucket: ${config.secrets.STORAGE_BUCKET || "not configured"}, max upload: ${config.variables.maxUploadBytes} bytes)`,
      );

      return { storage };
    }),

  shutdown: () => Effect.log("[Storage] Shutdown"),

  createRouter: (services, builder) => {
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
        return await services.storage.ping();
      }),

      requestUpload: builder.requestUpload
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await services.storage.requestUpload({
            uploaderAccountId: context.uploaderAccountId,
            filename: input.filename,
            contentType: input.contentType,
            sizeBytes: input.sizeBytes,
          });
        }),

      confirmUpload: builder.confirmUpload
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await services.storage.confirmUpload({
            uploaderAccountId: context.uploaderAccountId,
            key: input.key,
          });
        }),

      attachAsset: builder.attachAsset
        .use(requireNearAccount)
        .handler(async ({ input, context }) => {
          return await services.storage.attachAsset({
            uploaderAccountId: context.uploaderAccountId,
            key: input.key,
            ownerId: input.ownerId,
          });
        }),

      deleteFile: builder.deleteFile.use(requireNearAccount).handler(async ({ input, context }) => {
        return await services.storage.deleteFile({
          uploaderAccountId: context.uploaderAccountId,
          key: input.key,
        });
      }),
    };
  },
});
