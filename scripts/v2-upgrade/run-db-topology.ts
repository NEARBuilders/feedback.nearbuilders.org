import process from "node:process";
import { Cause, Effect, Exit } from "effect";
import type { StepResult } from "./steps/author-config";
import { patchDbTopology } from "./steps/patch-db-topology";

/**
 * Standalone post-upgrade maintenance step — patches the sync-owned api db
 * layer back onto the public-schema topology for the api workspace.
 *
 * Run with: pnpm db-topology [--dry-run]
 */
const run = async (): Promise<number> => {
  const projectDir = process.cwd();
  const dryRun = process.argv.includes("--dry-run");

  const exit = await Effect.runPromiseExit(patchDbTopology(projectDir, dryRun));

  if (Exit.isSuccess(exit)) {
    const result: StepResult = exit.value;
    if (result.writes.length === 0) {
      console.log(`db layer already on the api=public topology${dryRun ? " (dry-run)" : ""}`);
    }
    for (const path of result.writes) console.log(`  wrote: ${path}${dryRun ? " (dry-run)" : ""}`);
    for (const note of result.notes) console.log(`  note: ${note}`);
    return 0;
  }

  console.error("\nfailed:", Cause.pretty(exit.cause));
  return 2;
};

process.exitCode = await run();
