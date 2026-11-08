import { sql } from "drizzle-orm";
import { rounds as roundsTable } from "../db/schema";

/**
 * A round stays status "open" until its owner closes it, so one past `endsAt` is expired but still
 * open. These two helpers are the single definition of that rule: the in-memory form for fetched
 * rounds and the SQL form for queries. Keep them in step.
 */
export const isRoundExpired = (round: { endsAt: string | null }, now = Date.now()): boolean =>
  !!round.endsAt && Date.parse(round.endsAt) <= now;

/** SQL form of "open and not expired", for use in `where` or `filter (where ...)`. */
export const roundIsLiveSql = sql`(${roundsTable.status} = 'open' and (${roundsTable.endsAt} is null or ${roundsTable.endsAt} > now()))`;
