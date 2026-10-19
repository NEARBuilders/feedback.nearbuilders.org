import process from "node:process";
import { Cause, Effect, Exit } from "effect";
import type { StepResult } from "./steps/author-config";
import { portRouteGuards } from "./steps/port-route-guards";

/**
 * Standalone post-upgrade maintenance step — applies the upstream route
 * guard port to the current working directory.
 *
 * Run with: pnpm port-route-guards [--dry-run]
 */
const run = async (): Promise<number> => {
  const projectDir = process.cwd();
  const dryRun = process.argv.includes("--dry-run");

  const exit = await Effect.runPromiseExit(portRouteGuards(projectDir, dryRun));

  if (Exit.isSuccess(exit)) {
    const result: StepResult = exit.value;
    if (result.writes.length === 0) {
      console.log(`route guards already on the framework surface${dryRun ? " (dry-run)" : ""}`);
    }
    for (const path of result.writes) console.log(`  wrote: ${path}${dryRun ? " (dry-run)" : ""}`);
    for (const note of result.notes) console.log(`  note: ${note}`);
    return 0;
  }

  console.error("\nfailed:", Cause.pretty(exit.cause));
  return 2;
};

process.exitCode = await run();
