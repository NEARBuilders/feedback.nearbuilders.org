import process from "node:process";
import { Cause, Effect, Exit } from "effect";
import {
  AUTH_FIXTURE_PATH,
  type ComposeProbe,
  composeFindings,
  probeComposeSeam,
  readEveryPluginVersion,
} from "./checks/compose-seam";

/**
 * Standalone compose-seam guard — replays the host's SSR composition
 * (core ui /login claim vs the deployed auth-ui /login tree) through the
 * installed every-plugin constructTree. Expects the benign
 * "core ui wins; shadowed route skipped" log and a clean compose; a false
 * "unresolvable parentage" means the cascade-splice fix hasn't landed in
 * the installed version yet (see checks/compose-seam.ts).
 *
 * Run with: pnpm compose-seam [--live]
 */

const describe = (probe: ComposeProbe): string => {
  switch (probe.seam) {
    case "ok":
      return probe.composeLog.some((line) => line.includes("core ui wins"))
        ? "compose ok — core ui wins; shadowed auth routes skipped cleanly"
        : "compose ok — note: no /login shadow exercised (core ui no longer claims /login)";
    case "absent-ui-manifest":
      return "ui/src/manifest.gen.json absent — run `pnpm types:gen` first";
    case "cascade-bug":
      return 'KNOWN BUG — false "unresolvable parentage" for the /login shadow cascade';
    case "path-collision":
      return "REGRESSION — the /login shadow is treated as a hard path collision";
    case "compose-failed":
      return "compose failed";
  }
};

const run = async (): Promise<number> => {
  const projectDir = process.cwd();
  const live = process.argv.includes("--live");

  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const probe = yield* probeComposeSeam(projectDir, { live });
      const version = yield* readEveryPluginVersion(projectDir);
      const findings = composeFindings(probe, version);

      console.log(
        `compose-seam probe (every-plugin ${version}, auth manifest: ${live ? "live" : AUTH_FIXTURE_PATH})`,
      );
      console.log(`  seam: ${describe(probe)}`);
      for (const line of probe.composeLog) console.log(`  ${line}`);
      if (probe.error) console.log(`  error: ${probe.error}`);
      if (probe.mountCounts) console.log(`  mountCounts: ${JSON.stringify(probe.mountCounts)}`);
      for (const finding of findings) {
        console.error(`  [${finding.severity}] ${finding.message}`);
      }
      return findings.filter((finding) => finding.severity === "blocker").length;
    }),
  );

  if (Exit.isSuccess(exit)) {
    if (exit.value > 0) return 2;
    return 0;
  }
  console.error("\nfailed:", Cause.pretty(exit.cause));
  return 2;
};

process.exitCode = await run();
