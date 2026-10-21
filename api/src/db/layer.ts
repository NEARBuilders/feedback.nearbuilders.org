/**
 * The api's database seam (ADR 0033). The framework default (drizzle +
 * Postgres/PGlite, migrate-on-boot with the journal-scoped advisory lock,
 * drift detection) comes from `databaseLayer` in `everything-dev/db`; a
 * different storage situation is any other `Layer` provided for
 * `DatabaseTag`. The api keeps the v1 public-schema topology (what
 * `bos db doctor` checks and the drizzle-kit config targets), so
 * `namespace: false`.
 */
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { Effect } from "effect";
import { Context } from "effect";
import {
  type DatabaseError,
  databaseLayer,
  type LoadedMigrations,
  loadMigrations as loadSharedMigrations,
} from "everything-dev/db";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DatabaseTag extends Context.Service<DatabaseTag, Database>()("Database") {}

const loadMigrations: Effect.Effect<LoadedMigrations, DatabaseError> = loadSharedMigrations({
  fromDir: import.meta.dirname,
  virtual: () => import("virtual:drizzle-migrations.sql"),
});

export const DatabaseLive = (config: { pluginId: string; secrets: { API_DATABASE_URL: string } }) =>
  databaseLayer(DatabaseTag, config.secrets.API_DATABASE_URL, {
    pluginId: config.pluginId,
    schema,
    migrations: loadMigrations,
    namespace: false,
  });
