import {
  BAD_REQUEST,
  FORBIDDEN,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  UNAUTHORIZED,
} from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const AssetSchema = z.object({
  id: z.string(),
  key: z.string(),
  publicUrl: z.string().url(),
  uploaderAccountId: z.string(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  ownerId: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
});

export type Asset = z.infer<typeof AssetSchema>;

export const contract = oc.router({
  ping: oc.route({ method: "GET", path: "/ping" }).output(
    z.object({
      provider: z.string(),
      status: z.literal("ok"),
      configured: z.boolean(),
      timestamp: z.string(),
    }),
  ),

  requestUpload: oc
    .route({
      method: "POST",
      path: "/upload",
      summary: "Request a presigned upload URL",
      description:
        "Authenticated image upload for the caller's own namespace. The key is generated server-side and the URL is signed for the exact content type (#131).",
    })
    .input(
      z.object({
        filename: z.string().min(1),
        contentType: z.string().min(1),
        sizeBytes: z.number().int().positive(),
      }),
    )
    .output(
      z.object({
        presignedUrl: z.string().url(),
        assetId: z.string(),
        publicUrl: z.string().url(),
        key: z.string(),
      }),
    )
    .errors({ UNAUTHORIZED, BAD_REQUEST, SERVICE_UNAVAILABLE }),

  confirmUpload: oc
    .route({
      method: "POST",
      path: "/files/{key}/confirm",
      summary: "Confirm an uploaded object",
      description:
        "Verifies the object exists, re-checks the limits against the stored object, and marks the asset confirmed.",
    })
    .input(z.object({ key: z.string().min(1) }))
    .output(AssetSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, NOT_FOUND, SERVICE_UNAVAILABLE }),

  attachAsset: oc
    .route({
      method: "POST",
      path: "/files/{key}/attach",
      summary: "Attach an asset to an owner",
      description:
        "Records an optional owner reference (e.g. a feedback id) on an asset the caller uploaded.",
    })
    .input(z.object({ key: z.string().min(1), ownerId: z.string().min(1) }))
    .output(AssetSchema)
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE }),

  attachByUrls: oc
    .route({
      method: "POST",
      path: "/owners/{ownerId}/attach",
      summary: "Attach the caller's uploaded files to an owner by their public URLs",
      description:
        "Records `ownerId` (e.g. a feedback id) on the caller's own assets whose public URL appears in `urls`, so they can be removed with the owner later. URLs that are not the caller's assets are ignored.",
    })
    .input(z.object({ ownerId: z.string().min(1), urls: z.array(z.string().min(1)).max(50) }))
    .output(z.object({ attached: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED, SERVICE_UNAVAILABLE }),

  deleteByOwner: oc
    .route({
      method: "POST",
      path: "/owners/{ownerId}/delete",
      summary: "Delete every file the caller attached to an owner",
      description:
        "Deletes the objects and records of the caller's own assets attached to `ownerId` (e.g. when the feedback they belong to is removed). Assets uploaded by others are never touched.",
    })
    .input(z.object({ ownerId: z.string().min(1) }))
    .output(z.object({ deleted: z.number().int().nonnegative() }))
    .errors({ UNAUTHORIZED, SERVICE_UNAVAILABLE }),

  deleteFile: oc
    .route({
      method: "DELETE",
      path: "/files/{key}",
      summary: "Delete a stored file",
      description: "Deletes the object and its record. Only the uploader can delete an asset.",
    })
    .input(z.object({ key: z.string().min(1) }))
    .output(z.object({ success: z.boolean() }))
    .errors({ UNAUTHORIZED, FORBIDDEN, NOT_FOUND, SERVICE_UNAVAILABLE }),
});

export type ContractType = typeof contract;
