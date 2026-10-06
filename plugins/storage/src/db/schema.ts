import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const assetStatus = {
  pending: "pending",
  confirmed: "confirmed",
} as const;

export type AssetStatus = (typeof assetStatus)[keyof typeof assetStatus];

export const storageAssets = pgTable(
  "storage_assets",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    uploaderAccountId: text("uploader_account_id").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    ownerId: text("owner_id"),
    status: text("status").$type<AssetStatus>().notNull().default(assetStatus.pending),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("storage_assets_key_unique").on(table.key)],
);
