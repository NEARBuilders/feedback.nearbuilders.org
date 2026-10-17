import { Effect } from "effect";
import { audit } from "./audit";
import { scanImports } from "./checks/imports";
import { GateBlocked } from "./domain";
import { applyManifest } from "./steps/apply-manifest";
import { authorConfig, type StepResult } from "./steps/author-config";
import { migratePnpm } from "./steps/migrate-pnpm";

const printStep = (name: string, result: StepResult): void => {
  console.log(`\n[${name}]`);
  for (const path of result.writes) console.log(`  wrote: ${path}`);
  for (const path of result.deletes) console.log(`  deleted: ${path}`);
  for (const note of result.notes) console.log(`  note: ${note}`);
};

export const apply = (projectDir: string, dryRun: boolean): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const report = yield* audit(projectDir);
    if (report.manifest.blockerCount > 0) {
      return yield* Effect.fail(
        new GateBlocked({
          findings: report.findings.filter((f) => f.severity === "blocker"),
        }),
      );
    }

    console.log(
      `gate passed — Tier ${report.tier}, proceeding with apply${dryRun ? " (dry-run)" : ""}`,
    );

    const rewrites = yield* scanImports(projectDir);

    const configResult = yield* authorConfig(projectDir, report.manifest.plugins, dryRun);
    printStep("author-config", configResult);

    const pnpmResult = yield* migratePnpm(projectDir, dryRun);
    printStep("migrate-pnpm", pnpmResult);

    const manifestResult = yield* applyManifest(projectDir, rewrites, dryRun);
    printStep("apply-manifest", manifestResult);

    console.log(
      "\nnext: pnpm install && node node_modules/.bin/bos types gen && node node_modules/.bin/bos sync",
    );
  });
