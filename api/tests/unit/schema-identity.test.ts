import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

/**
 * Feedback data is keyed on NEAR accounts only (#121), so it keeps working once auth is shared
 * with nearbuilders.org. User ids and sessions may be used transiently (for example team
 * membership checks against the auth service) but must never be stored in an API table.
 */
const FORBIDDEN_COLUMN = /(^|_)user_?id$|(^|_)session/;

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];

describe("API schema identity (#121)", () => {
  it("finds the API tables", () => {
    expect(tables.length).toBeGreaterThan(5);
  });

  it.each(
    tables.map((table) => [getTableConfig(table).name, table] as const),
  )("%s has no user id or session column", (_name, table) => {
    const offenders = getTableConfig(table)
      .columns.map((column) => column.name)
      .filter((name) => FORBIDDEN_COLUMN.test(name));
    expect(offenders).toEqual([]);
  });

  it("keys people on NEAR account columns", () => {
    const columns = tables.flatMap((table) => getTableConfig(table).columns.map((c) => c.name));
    for (const name of [
      "owner_account_id",
      "account_id",
      "author_account_id",
      "builder_account_id",
      "recipient_account_id",
    ]) {
      expect(columns).toContain(name);
    }
  });
});
