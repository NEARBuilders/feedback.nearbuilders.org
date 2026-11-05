import { readdirSync, rmSync } from "node:fs";

/**
 * Each test file fork gets its own PGlite data dir under `.bos/db/test-<pid>`
 * (see TEST_CONFIG in ./setup.ts). Forks die with their process, so most dirs
 * outlive the run — wipe the stale ones before a new suite starts. Safe: test
 * forks haven't spawned yet, and the dev server's DB is `.bos/db` itself.
 */
export default function () {
  try {
    for (const entry of readdirSync(".bos/db")) {
      if (entry.startsWith("test-")) {
        rmSync(`.bos/db/${entry}`, { recursive: true, force: true });
      }
    }
  } catch {
    // no .bos/db yet — nothing to clean
  }
}
