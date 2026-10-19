import process from "node:process";
import { Cause, Effect, Exit } from "effect";
import type { StepResult } from "./steps/author-config";
import { migrateI18nSeam } from "./steps/migrate-i18n-seam";

/**
 * Standalone post-upgrade maintenance step — wires the shared i18n runtime
 * into the core UI so the federation share scope provides @lingui/* to the
 * host's auth plugin (RUNTIME-012 at SSR composition otherwise).
 *
 * Run with: pnpm i18n-seam [--dry-run]
 */
const run = async (): Promise<number> => {
  const projectDir = process.cwd();
  const dryRun = process.argv.includes("--dry-run");

  const exit = await Effect.runPromiseExit(migrateI18nSeam(projectDir, dryRun));

  if (Exit.isSuccess(exit)) {
    const result: StepResult = exit.value;
    if (result.writes.length === 0) {
      console.log(`i18n seam already wired${dryRun ? " (dry-run)" : ""}`);
    }
    for (const path of result.writes) console.log(`  wrote: ${path}${dryRun ? " (dry-run)" : ""}`);
    for (const note of result.notes) console.log(`  note: ${note}`);
    return 0;
  }

  console.error("\nfailed:", Cause.pretty(exit.cause));
  return 2;
};

process.exitCode = await run();
