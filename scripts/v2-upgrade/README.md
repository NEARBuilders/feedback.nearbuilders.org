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

