# Identity-keying audit: feedback.nearbuilders.org

Issue: #224 (the feedback instance of NEARBuilders/nearbuilders.org#329, which defines the convention). Audited at `6cbd739` (origin/main, 31 Oct). Audit order: nearbuilders.org, then this repo, then activity.nearbuilders.org.

## Convention checked against

- Canonical owner id: `context.near.primaryAccountId ?? userId`. This app goes further: since #121, feedback data is keyed on NEAR accounts only, and no auth user id is ever stored.
- "Is this mine" checks fan out over the primary account plus every linked account. Here that is `linkedAccountIds()` in `api/src/services/linked-accounts.ts:13-21`.
- Tables carry a NEAR-account key. A nullable `userId` sibling is optional, and this app deliberately has none.
- No app code reads the auth DB. Team membership goes through the auth plugin client.
- Nothing is keyed on a session id.

## Severity scale

| Severity | Meaning |
| --- | --- |
| High | Rows keyed only on an auth user id or session id. They need a backfill to survive the shared auth DB. |
| Medium | Rows are account-keyed, but a read, ownership or write path uses only the current primary account. Linking or switching accounts strands the user's own data. Read-path fix, no migration. |
| Low | A non-account value can land in an account column, there is a gap in the guard test, or the drift is cosmetic. |

## Summary

- **High: none.** Every user-referencing column in the API schema is a NEAR account id. `api/tests/unit/schema-identity.test.ts` already fails the build if an API table gains a `user_id` or `session*` column, which covers #224's acceptance criterion "no write path can key new data on session id" for the API schema.
- **Medium (1):** the storage plugin resolves the uploader from the primary account only, so assets uploaded under one linked account can't be confirmed, deleted or attached once the user acts as another.
- **Low (3):** one write path can store an auth user id in `starred_by_account_id`, the storage plugin's schema isn't covered by the identity guard test, and the Legion access hint checks only the primary account.
- Rounds, participation, feedback, notes, credits and notifications all resolve "mine" across linked accounts already.

## Schema inventory

| Table.column | Holds | Verdict |
| --- | --- | --- |
| `rounds.owner_account_id` (`api/src/db/schema.ts:107`) | primary account at creation (`api/src/index.ts:488`) | OK; ownership fans out (`api/src/services/round-access.ts:26,62`) |
| `round_participants.account_id` (`api/src/db/schema.ts:157`) | the account that joined | OK; posting reuses it (`api/src/index.ts:993`) |
| `round_feedback.author_account_id` (`api/src/db/schema.ts:185`) | participant account | OK; author checks fan out (`api/src/index.ts:1117-1119`) |
| `round_feedback.starred_by_account_id` (`api/src/db/schema.ts:193`) | `primaryAccountId ?? user.id ?? "admin"` (`api/src/index.ts:1286`) | **Low (L1)** |
| `feedback_notes.author_account_id` (`api/src/db/schema.ts:217`) | manager's primary account, or the feedback author (`api/src/index.ts:1137`) | OK |
| `round_credits.builder_account_id` (`api/src/db/schema.ts:237`) | participant account | OK |
| `notifications.recipient_account_id` (`api/src/db/schema.ts:268`) | participant account | OK; inbox reads fan out (`api/src/index.ts:1051`) |
| `projects.verified_by_account_id` (`api/src/db/schema.ts:90`) | admin primary account or null (`api/src/index.ts:699`) | OK (audit only) |
| `projects.owner_org_id`, `managing_team_id` (`api/src/db/schema.ts:77,79`) | organization / team ids from the auth plugin | OK (not user-keyed) |
| `activity_outbox.actor` (`api/src/db/schema.ts:331`) | account id | OK |
| `tenants.account_id` (`api/src/db/schema.ts:44`) | dead table, no reads or writes | n/a |
| `storage_assets.uploader_account_id` (`plugins/storage/src/db/schema.ts:15`) | primary account at upload | OK as a key; read path is M1 |
| `storage_assets.owner_id` (`plugins/storage/src/db/schema.ts:19`) | feedback or round id the asset is attached to, not a person | OK |

## Findings

### M1. Storage acts only as the primary account (Medium)

- `plugins/storage/src/index.ts:79-90`: `requireNearAccount` sets `uploaderAccountId = context.near.primaryAccountId`. Every owned-asset check compares against that single value: `plugins/storage/src/services/storage.ts:160` (`resolveOwnedAsset`), `:221,259,274` (confirm, delete, read), and `:287,305` (attach by URL and delete by owner).
- The API attaches feedback images by acting as the feedback's author account (`api/src/services/feedback-assets.ts:50-58,76`) and round banners as the round owner (`:100,112`). The author account is the one that *joined* the round, which `actingAccountId` deliberately keeps even after a primary switch (`api/src/index.ts:992-993`).
- Failure case: a tester joins a round as account A, switches primary to linked account B, then uploads an image and posts feedback. The upload is stored under B, the feedback is authored by A, and `attachByUrls` filters on `uploader = A`, so the image is never attached. Deleting that feedback later won't clean the asset up either. The same applies to round banners after an owner switches primary. A user also can't delete their own earlier uploads after switching.
- Fix: pass the caller's linked account ids into the storage context, and match `uploader_account_id IN (...)` in the owned-asset checks. For server-side attach, accept the author's linked set, or attach by `(url, uploader in linked set)`. No migration.

### L1. `starred_by_account_id` can receive an auth user id (Low)

- `api/src/index.ts:1286`: `viewer.near?.primaryAccountId ?? viewer.user?.id ?? "admin"`. A site admin without a NEAR account who stars feedback writes their auth user id (or the literal `"admin"`) into an account column. The schema guard test can't catch this because the column name is correct.
- Impact: audit trail only, never used for authorization. It is the only write path found that can store an auth user id.
- Fix: one line, store `linkedAccountIds(context)[0] ?? null` (the column is nullable). Left out of this PR on purpose so it can ship with a test. See ticket 2.

### L2. The identity guard test skips plugin schemas (Low)

- `api/tests/unit/schema-identity.test.ts:4` imports only `@/db/schema`. `plugins/storage/src/db/schema.ts` (and any future plugin table) isn't checked for `user_id` or `session*` columns.
- Fix: run the same assertions over every plugin schema module, or add a sibling test per plugin.

### L3. The Legion access hint checks only the primary account (Low)

- `api/src/index.ts:948-952` (`getMyLegionAccess`) passes `primaryAccountId` only. Enforcement uses the participant account (`api/src/index.ts:1000`, `assertLegionAccess(round, accountId, ...)`), so access control is correct. But the UI hint can say "no access" when a linked account holds the SBT, or the reverse.
- Fix: check the linked set and report which account qualifies.

## Not findings (checked)

- Round management: `resolveActor` (`api/src/index.ts:297-322`) carries `accountIds` from `linkedAccountIds`, and `actorOwnsAccount` (`api/src/services/round-access.ts:26`) matches any of them.
- Team delegation compares the auth `userId` against `listTeamMembers` through the auth plugin client (`api/src/services/team-access.ts:24-28`). This is a transient check through the auth plugin surface: nothing is stored and the auth DB isn't read. The new auth DB must keep team membership keyed on the same user, but nothing in this repo changes for that.
- Joined rounds, joining and posting (`api/src/index.ts:867,916,959,973-993`), feedback visibility and notes (`:1105,1117`), and the notifications inbox (`:1051`) all use `linkedAccountIds`.
- The org API key path acts as its organization and stores nothing per user (`api/src/index.ts:302-306`).
- No code in `api/`, `plugins/` or `ui/` touches `near_accounts`, `is_primary` or an auth database URL. The UI reads accounts only from the auth client session (`ui/src/lib/auth.ts:102-123`).

## Proposed fix tickets

Not filed. The user decides which to open.

| # | Title | Severity | Migration / backfill |
| --- | --- | --- | --- |
| 1 | storage: resolve the uploader across all linked accounts (confirm, delete, attach, delete-by-owner) | Medium | No |
| 2 | Star feedback: never write an auth user id into `starred_by_account_id` | Low | Optional: null out any non-account values (expected to be zero or a handful) |
| 3 | Extend the schema identity guard test to plugin schemas (storage, future plugins) | Low | No |
| 4 | `getMyLegionAccess`: check every linked account and report which one holds the SBT | Low | No |
