import type { Database } from "./index";

/** A drizzle transaction handle, derived from `Database.transaction`. */
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
