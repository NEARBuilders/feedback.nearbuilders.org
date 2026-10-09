# Runbook: moving feedback onto the shared nearbuilders.org auth database

Tracks [#110](https://github.com/NEARBuilders/feedback.nearbuilders.org/issues/110) (epic [#124](https://github.com/NEARBuilders/feedback.nearbuilders.org/issues/124)).

After the cutover feedback.nearbuilders.org and nearbuilders.org read the same auth database, so
they share users, NEAR accounts, organizations and teams. Feedback's own data is keyed by NEAR
account (#121) and carries over unchanged. Only two columns point into the auth DB and need
rewriting: `projects.owner_org_id` and `projects.managing_team_id`.

## What the tooling does

All commands run from the repo root. Every database is addressed by an environment variable:

| Variable | Database |
| --- | --- |
| `FEEDBACK_AUTH_DATABASE_URL` | Feedback's current auth DB (only read) |
| `SHARED_AUTH_DATABASE_URL` | nearbuilders.org's auth DB, which feedback moves onto |
| `API_DATABASE_URL` | Feedback's API DB (holds `projects`) |

- `bun run auth:check-schema <VAR> [<VAR> ...]` reports how far each auth DB is through the
  auth plugin's migrations (`0000` … `0010`), by checking the tables, columns and constraints
  each migration leaves behind. It exits non-zero when a DB is behind.
- `bun run auth:cutover [--overrides overrides.json] [--report plan.json] [--apply]` plans and
  performs the remap:
  - **Orgs** referenced by a project map to the shared org with the same id, else the same
    slug, else they are copied with their id.
  - **Teams** of those orgs map to the shared team with the same id, else the same name
    (case-insensitive) in the mapped org, else they are copied with their id.
  - **Users** holding a membership in those orgs/teams map to the shared user with the same id,
    else the one owning the same NEAR account, else the same email, else they are copied (user,
    NEAR accounts, provider accounts) with their ids. Site roles (`user.role`) are never copied.
  - **Memberships** missing from the shared DB are added. Where a membership already exists the
    shared role is kept and the difference is reported.
  - **Projects** are rewritten to the mapped ids. Each update only applies while the row still
    holds the ids the plan was made from.
  - Afterwards every project must point at an org that exists in the shared DB and, when
    delegated, at a team inside that org; otherwise everything rolls back.

  Without `--apply` it is a dry run: all writes are executed inside one transaction per DB,
  verified, and rolled back. With `--apply` the shared auth DB commits first, then the feedback
  DB. The auth inserts are idempotent, so if the second commit fails, re-run the command.
  Re-running after a successful cutover plans nothing.

  Anything it cannot decide safely is reported as a conflict, and nothing is written until the
  conflicts are gone. Typical fixes are an overrides file for orgs/teams whose slug or name
  differs between the apps:

  ```json
  {
    "organizations": { "<feedback org id>": "<shared org id>" },
    "teams": { "<feedback team id>": "<shared team id>" }
  }
  ```

## Steps

### 1. Make copies

Take `pg_dump` snapshots of all three databases and restore them into scratch databases. Every
step up to 6 runs against the copies only.

```sh
pg_dump --no-owner --format=custom "$PROD_SHARED_AUTH_URL" > shared-auth.dump
pg_dump --no-owner --format=custom "$PROD_FEEDBACK_AUTH_URL" > feedback-auth.dump
pg_dump --no-owner --format=custom "$PROD_FEEDBACK_API_URL" > feedback-api.dump
pg_restore --no-owner --dbname "$SHARED_AUTH_DATABASE_URL" shared-auth.dump
pg_restore --no-owner --dbname "$FEEDBACK_AUTH_DATABASE_URL" feedback-auth.dump
pg_restore --no-owner --dbname "$API_DATABASE_URL" feedback-api.dump
```

### 2. Migrate the shared auth DB forward (`0000` → `0010`)

nearbuilders.org's live auth DB is at `0000`; the auth plugin feedback runs is at `0010`.

```sh
bun run auth:check-schema SHARED_AUTH_DATABASE_URL FEEDBACK_AUTH_DATABASE_URL
```

Bring the copy forward by booting the current auth plugin against it, so its own migrator applies
`0002` … `0010` and records them in its journal. For example, run this repo locally with
`AUTH_DATABASE_URL` set to the copy (`bun run dev`) and wait for the auth plugin to finish
starting. Do not apply the SQL by hand: the runtime tracks applied migrations by hash, and
replaying an `ALTER`-only migration it has not recorded fails on the next boot.

Then run `auth:check-schema` again; it must report `applied through 0010_preserve-approved-organizations`.
Compare row counts of `user`, `near_account`, `organization`, `member`, `team` and `apikey` before
and after; the forward path only adds tables and columns (organizations get `status = 'active'`),
so the counts must match. `api/tests/unit/shared-auth-cutover.test.ts` replays exactly this path
on a populated `0000` database, using the upstream migrations copied into
`api/tests/fixtures/auth-migrations/`.

In production, the shared DB reaches `0010` by upgrading nearbuilders.org to the current auth
plugin (same boot-time migration). Do that before step 6. The cutover refuses to run against a
shared DB that is behind.

### 3. Dry-run the remap on the copies

```sh
bun run auth:cutover --report plan.json
```

Review the summary and `plan.json`:

- every org/team resolution (same id, slug/name match, override, copy) is what you expect;
- role differences: the shared role wins, so fix them in the shared DB if feedback's should;
- the API keys listed must be re-issued (step 7).

Resolve conflicts with an overrides file and repeat until the dry run passes. Then run it once
with `--apply` against the copies and point a local feedback instance at them
(`AUTH_DATABASE_URL` = shared copy, `API_DATABASE_URL` = feedback copy) to check the acceptance
criteria by hand: projects show under the right org, and a team-delegated round manager who is
not an org admin can still close a round.

### 4. Secrets

- `BETTER_AUTH_SECRET` must be identical in the feedback and nearbuilders.org deployments. Use
  nearbuilders.org's value, because its sessions already live in the shared DB.
- `AUTH_DATABASE_URL` on the feedback Railway service points at the shared DB.
- Provider tokens copied for feedback-only users were written under feedback's old secret. They
  are refreshed on the user's next sign-in.

### 5. Cookies, origins and SSO

The auth plugin sets `sameSite: "lax"` session cookies without a `domain`, has no
`crossSubDomainCookies` option, and `trustedOrigins` defaults to `[baseUrl]`. Each app therefore
keeps its own host-only session cookie and trusts only its own origin. Sharing the database
works without any cookie change: users sign in to each app separately, as the same identity.

**Decision (proposed, confirm before cutover):** no cross-subdomain SSO for this migration.
Users sign in per app. Shared identity, orgs and teams are what #110 needs; SSO is a separate
UX improvement. It would require an upstream change to the auth plugin, and widening the cookie
to `.nearbuilders.org` puts every subdomain in the session's trust boundary.

If SSO is wanted later, file this upstream on [NEARBuilders/everything-dev](https://github.com/NEARBuilders/everything-dev/issues):

> **Auth plugin: optional cross-subdomain session cookies**
>
> Apps that share one auth DB (feedback.nearbuilders.org and nearbuilders.org) want one sign-in
> across subdomains. Add an optional plugin variable (e.g. `crossSubDomainCookies: { enabled,
> domain }`) passed through to Better Auth's `advanced.crossSubDomainCookies`, and let
> `trustedOrigins` include the sibling origins. Default off; no behaviour change for existing
> deployments.

### 6. Cut over production

1. Announce a short maintenance window (round management is briefly unavailable).
2. Confirm the shared DB is at `0010`: `bun run auth:check-schema SHARED_AUTH_DATABASE_URL`.
3. With the production URLs exported, dry-run: `bun run auth:cutover --report plan.json`.
4. Back up the column being rewritten:
   `pg_dump --data-only --table=projects "$API_DATABASE_URL" > projects-before-cutover.sql`.
5. Apply: `bun run auth:cutover --apply`.
6. Update the feedback Railway service: `AUTH_DATABASE_URL` → shared DB, `BETTER_AUTH_SECRET` →
   the shared value. Redeploy (`railway redeploy --service feedback-app --yes`).
7. Smoke test: sign in, open the owner dashboard of a migrated org, close or edit a round as a
   team member, and check an org admin can still change a project's managing team.

Rollback: revert `AUTH_DATABASE_URL` and `BETTER_AUTH_SECRET` if they were changed, and restore
`owner_org_id` / `managing_team_id` from `plan.json` (each project update lists `from` and `to`)
or from the item 4 backup. Rows added to the shared DB can stay; they are ordinary orgs, teams and
memberships.

### 7. Sessions and API keys

Feedback's sessions and API keys stay in feedback's old auth DB and do not exist in the shared
one.

- Everyone signs in to feedback again after the cutover. Say so in the announcement.
- Organization API keys (`org_…`) and personal keys (`api_…`) must be re-issued in the shared
  DB. The dry-run summary lists every key with its owning org/user. Contact those owners and
  ask them to create new keys after the cutover.

Keep feedback's old auth DB read-only for a few weeks as a reference, then decommission it.
