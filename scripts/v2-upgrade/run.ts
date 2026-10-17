import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { Cause, Effect, Exit, Option } from "effect";
import { apply } from "./apply";
import { audit, printReport } from "./audit";
import { GateBlocked } from "./domain";

const writeManifest = (projectDir: string, manifestJson: string) =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(join(projectDir, ".bos"), { recursive: true });
      await writeFile(join(projectDir, ".bos/v2-upgrade-manifest.json"), manifestJson);
    },
    catch: (error) => new Error(`failed to write manifest: ${String(error)}`),
  });

const run = async (): Promise<number> => {
  const projectDir = process.cwd();
  const json = process.argv.includes("--json");
  const applyMode = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");

  const program = applyMode
    ? apply(projectDir, dryRun)
    : audit(projectDir).pipe(
        Effect.tap((report) =>
          writeManifest(projectDir, `${JSON.stringify(report.manifest, null, 2)}\n`),
        ),
        Effect.tap((report) => {
          if (json) {
            console.log(JSON.stringify(report.manifest, null, 2));
          } else {
            printReport(report);
          }
        }),
        Effect.flatMap((report) =>
          report.manifest.blockerCount === 0
            ? Effect.void
            : Effect.fail(new GateBlocked({ findings: report.findings })),
        ),
      );

  const exit = await Effect.runPromiseExit(program);

  if (Exit.isSuccess(exit)) return 0;

  const failure = Option.getOrNull(Cause.failureOption(exit.cause));
  if (failure instanceof GateBlocked) {
    console.error("\nGATE BLOCKED — normalize in v1 before upgrading to v2.");
    return 1;
  }
  console.error("\nfailed:", Cause.pretty(exit.cause));
  return 2;
};

process.exitCode = await run();
