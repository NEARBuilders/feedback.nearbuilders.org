import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../db/schema";

/**
 * Same guard as the API schema (#121, #224): people are keyed on NEAR accounts, so auth user
 * ids and session ids must never be stored in a table.
 */
const FORBIDDEN_COLUMN = /(^|_)user_?id$|(^|_)session/;

const tables = Object.values(schema).filter((value) => is(value, PgTable)) as PgTable[];

describe("storage schema identity (#224)", () => {
  it("finds the storage tables", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(
    tables.map((table) => [getTableConfig(table).name, table] as const),
  )("%s has no user id or session column", (_name, table) => {
    const offenders = getTableConfig(table)
      .columns.map((column) => column.name)
      .filter((name) => FORBIDDEN_COLUMN.test(name));
    expect(offenders).toEqual([]);
  });

  it("keys uploads on a NEAR account column", () => {
    const columns = tables.flatMap((table) => getTableConfig(table).columns.map((c) => c.name));
    expect(columns).toContain("uploader_account_id");
  });
});
