// Fails on bare module specifiers imported by a package's source but not
// declared in that package's package.json. This is the pnpm-isolated-layout
// check: imports resolve against stale hoisted node_modules locally and fail
// on CI's fresh install. Relative paths, node builtins, subpath aliases
// (#*/, @/), and self-imports pass.
import { readdir, readFile, stat } from "node:fs/promises";
import module from "node:module";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGES = ["", "ui", "api", ...(await listPlugins())];
const EXTSCAN = /\.(tsx?|jsx|mjs|cjs|mts|cts)$/;
const SPEC_RE =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["'"]([^"'"\n\r]+)["'"]/g;
const SPEC_TPL_RE = /\bimport\s*\(\s*`([^`$\n\r]+)`/g;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".gen",
  ".bos",
  ".tanstack",
  "coverage",
  "build",
  ".next",
]);

async function listPlugins() {
  const entries = await readdir(path.join(ROOT, "plugins")).catch(() => []);
  const out = [];
  for (const e of entries) {
    try {
      await stat(path.join(ROOT, "plugins", e, "package.json"));
      out.push(`plugins/${e}`);
    } catch {}
  }
  return out;
}

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) await walk(p, out);
    } else if (EXTSCAN.test(e.name) && !/\.(d\.(m|c)?ts)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function declared(pkg) {
  const d = JSON.parse(pkg);
  const names = new Set();
  for (const s of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const k of Object.keys(d[s] ?? {})) names.add(k);
  }
  const self = d.name;
  return { names, self };
}

let failure = false;
for (const p of PACKAGES) {
  const dir = path.join(ROOT, p);
  const { names, self } = declared(await readFile(path.join(dir, "package.json"), "utf8"));
  const isRoot = p === "";
  for (const file of await walk(dir)) {
    const src = (await readFile(file, "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    for (const m of [...src.matchAll(SPEC_RE), ...src.matchAll(SPEC_TPL_RE)]) {
      const spec = m[1];
      if (
        spec.startsWith(".") ||
        spec.startsWith("#") ||
        spec.startsWith("@/") ||
        spec.startsWith("virtual:") ||
        spec.startsWith("node:") ||
        spec.startsWith("bun:") ||
        /^[a-z]:/.test(spec) ||
        module.builtinModules.includes(spec)
      ) {
        continue;
      }
      const name = spec.startsWith("@")
        ? spec.split("/").slice(0, 2).join("/")
        : spec.split("/")[0];
      if (name === self) continue;
      if (isRoot) continue; // root imports resolve against declared roots + workspace links
      if (!names.has(name)) {
        failure = true;
        console.error(`${path.relative(ROOT, file)}: undeclared import "${name}" (from "${spec}")`);
      }
    }
  }
  if (!isRoot) {
    for (const dep of names) {
      if (dep.startsWith("@") && dep === self) {
        console.error(`${p}: package self-reference in deps`);
        failure = true;
      }
    }
  }
}

if (failure) {
  console.error(
    '\nFix: add the import to the exporting package\'s package.json dependencies (workspace catalog refs use "catalog:").',
  );
  process.exit(1);
}
console.error("check:deps: all imports declared.");
