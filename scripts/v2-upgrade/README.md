# v2 upgrade tooling

Audits an everything-dev v1 child app for upgrade readiness (mount
conformance gate, config surface, legacy imports) and applies the
deterministic transforms for the v2 train (`pnpm migrate`, descriptor
authoring, manifest rewrites):

```bash
pnpm run audit:v2            # audit; emits .bos/v2-upgrade-manifest.json
pnpm run audit:v2 --apply    # consume the v1 tree and rewrite it
pnpm run audit:v2 --dry-run --apply
pnpm run test:v2-upgrade     # vitest suite
```

The hardline audit gate blocks unknown mounts, nested routes, and ungated
authed layouts (Tier B) before apply mode will run; Tier A trees pass.

**Scope note:** the audit reads `bos.config.json` and reports its absence as
a Tier B blocker. That is a v1-state precondition — after the v2 upgrade the
config is intentionally replaced by the authored `bos.app.ts`, so running
the audit on an already-upgraded tree reports a blocker that is not a
problem. The audit is for pre-upgrade trees only; once a repo is on v2,
drive changes from `bos sync` / `bos upgrade`.

## Post-upgrade maintenance: port-route-guards

```bash
pnpm port-route-guards [--dry-run]
```

Rewrites authed mount guards to the framework's canonical session
resolution (`requireSession` from `everything-dev/ui/auth`) and patches the
root's session wiring to `resolveSessionFromCache` with explicit
signed-out seeding. The `route-guards` audit check flags drift from these
patterns — reimplemented inline resolution diverges from the cached view
of the same `["session"]` key and ping-pongs `/login` ↔ the guarded route
until the router's redirect budget trips ("Too many redirects").

Upstream snapshots in `fixtures/upstream/routes/` are pinned to
`upstream-ref.ts` with the gitHead commit of the installed package version,
so the patterns match the dist surface actually in `node_modules`.

## Post-upgrade maintenance: db-topology

```bash
pnpm db-topology [--dry-run]
```

Patches the sync-owned `api/src/db/layer.ts` back onto the public-schema
topology for the api workspace (`slug === "api" → undefined schemaName`).
The upstream template namespaces every workspace into `plugin_<slug>`, but
the api's own surfaces all assume public: `bos db doctor` checks the public
schema, the drizzle-kit config targets public (no `schemaNames`), and every
v1-upgraded database has its tables in public with a full migration journal.
Under the template, the rc.10-upgrade's edited migrations (`0002`, `0010`)
re-ran into `plugin_api` — landing a stray `rounds` table there — drift went
`drift-manual` (9/10 expected tables "missing", the real ones sitting in
public), and the api plugin refused to boot: every `/api/*` route returned
503. `bos db repair` refuses drift-manual by design, so the fix is this
patch plus dropping the stray `plugin_api` schema in the database.

This is also a regression guard: `bos sync` restores the upstream template
until the upstream fix lands, so re-run this step after syncs. The
`db-topology` check flags the template form.

## Post-upgrade maintenance: i18n-seam

```bash
pnpm i18n-seam [--dry-run]
```

Wires the shared i18n runtime into the core UI: app-owned
`ui/src/i18n/catalogs.ts` (locales + message catalogs, derived from the
`appLocale` bootstrap export) and `ui/src/i18n/runtime.tsx`
(`createLocaleRuntime` → `AppI18nProvider`), mounted in the root route. The
host's auth plugin consumes shared `@lingui/*` with `import: false` — only
the app's own UI (the core-ui provider in the child's federation graph) can
provide them. A core UI that never imports `everything-dev/ui/i18n` at
runtime ships no `@lingui/*` share-scope entries and boot fails at SSR
composition with RUNTIME-012 ("The getter for the shared module is not a
function … shareKey @lingui/core"). The `i18n-seam` check flags a missing or
unmounted seam, and catalogs that drift from `appLocale`.

