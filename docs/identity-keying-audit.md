# Identity-keying audit: feedback.nearbuilders.org

Issue: #224 (the feedback instance of NEARBuilders/nearbuilders.org#329, which defines the convention). Audited at `6cbd739` (origin/main, 31 Oct), then re-checked at `f6e84b0` after #228 landed fixes for L1–L3. Audit order: nearbuilders.org, then this repo, then activity.nearbuilders.org.

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
- **Low (4):** L1–L3 are fixed in #228. They were a write path that could store an auth user id in `starred_by_account_id`, the storage plugin's schema missing from the identity guard test, and the Legion access hint checking only the primary account. L4 is open: the rounds table compares a single UI account with the round owner.
- **Open:** M1 and L4.
- On the server, rounds, participation, feedback, notes, credits and notifications all resolve "mine" across linked accounts already. The one UI gap is L4.

## Schema inventory

| Table.column | Holds | Verdict |
| --- | --- | --- |
| `rounds.owner_account_id` (`api/src/db/schema.ts:107`) | primary account at creation (`api/src/index.ts:488`) | OK; ownership fans out (`api/src/services/round-access.ts:26,62`) |
| `round_participants.account_id` (`api/src/db/schema.ts:157`) | the account that joined | OK; posting reuses it (`api/src/index.ts:994`) |
| `round_feedback.author_account_id` (`api/src/db/schema.ts:185`) | participant account | OK; author checks fan out (`api/src/index.ts:1117-1119`) |
| `round_feedback.starred_by_account_id` (`api/src/db/schema.ts:193`) | first linked account or null (`api/src/index.ts:1288`) | OK (L1, fixed in #228) |
| `feedback_notes.author_account_id` (`api/src/db/schema.ts:217`) | manager's primary account, or the feedback author (`addFeedbackNote`, `api/src/index.ts:1137`); manager's primary account for the note on a status change (`setFeedbackStatus` via `nearAccountForNotes`, `api/src/index.ts:1255`, inserted in `api/src/services/rounds.ts:999-1004`) | OK. Always an account id. Manager notes record the current primary, but the column is only displayed (`ui/src/components/feedback-notes.tsx:21`) and never used for an ownership check, so nothing is stranded |
| `round_credits.builder_account_id` (`api/src/db/schema.ts:237`) | participant account | OK |
| `notifications.recipient_account_id` (`api/src/db/schema.ts:268`) | participant account | OK; inbox reads fan out (`api/src/index.ts:1051`) |
| `projects.verified_by_account_id` (`api/src/db/schema.ts:90`) | admin primary account or null (`api/src/index.ts:699`) | OK (audit only) |
| `projects.owner_org_id`, `managing_team_id` (`api/src/db/schema.ts:77,79`) | organization / team ids from the auth plugin | OK (not user-keyed) |
| `activity_outbox.actor` (`api/src/db/schema.ts:331`) | account id | OK |
| `tenants.account_id` (`api/src/db/schema.ts:44`) | dead table, no reads or writes | n/a |
| `storage_assets.uploader_account_id` (`plugins/storage/src/db/schema.ts:15`) | primary account at upload | OK as a key (guard test since #228); read path is M1 |
| `storage_assets.owner_id` (`plugins/storage/src/db/schema.ts:19`) | feedback or round id the asset is attached to, not a person | OK |

## Findings

### M1. Storage acts only as the primary account (Medium)

- `plugins/storage/src/index.ts:79-90`: `requireNearAccount` sets `uploaderAccountId = context.near.primaryAccountId`. Every owned-asset check compares against that single value: `plugins/storage/src/services/storage.ts:160` (`resolveOwnedAsset`), `:221,259,274` (confirm, attach, delete), and `:287,305` (attach by URL and delete by owner).
- The API attaches feedback images by acting as the feedback's author account (`api/src/services/feedback-assets.ts:50-58,76`) and round banners as the round owner (`:100,112`). The author account is the one that *joined* the round: joining keeps an existing participation via `actingAccountId` (`api/src/index.ts:903`), and posting looks that account up with `findParticipantAccount` (`api/src/index.ts:994`), even after a primary switch.
- Failure case: a tester joins a round as account A, switches primary to linked account B, then uploads an image and posts feedback. The upload is stored under B, the feedback is authored by A, and `attachByUrls` filters on `uploader = A`, so the image is never attached. Deleting that feedback later won't clean the asset up either. The same applies to round banners after an owner switches primary. A user also can't delete their own earlier uploads after switching.
- Org-manager case: a member who manages the round but isn't its owner hits the same gap even with linked accounts handled. Setting a banner through `updateRound` attaches it acting as the round owner (`api/src/index.ts:565-569`), but the file was uploaded under the manager's account. So it is never attached, and removing the banner (`:560-563`) or deleting the round (`:811-812`) leaves it orphaned. A manager removing someone's feedback deletes its images acting as the author's account only (`api/src/index.ts:1226`), so images the author uploaded under another linked account stay behind. The caller's linked accounts don't help here, because the files aren't the caller's.
- Fix: pass the caller's linked account ids into the storage context, and match `uploader_account_id IN (...)` in the owned-asset checks. For server-side attach, accept the author's linked set, or attach by `(url, uploader in linked set)`. For the manager case, attach as the caller who uploaded the file, and delete by owner id (round or feedback) through a server-only path rather than by uploader. No migration.

### L1. `starred_by_account_id` could receive an auth user id (Low, fixed in #228)

- Was: `viewer.near?.primaryAccountId ?? viewer.user?.id ?? "admin"`. A site admin without a NEAR account who starred feedback wrote their auth user id (or the literal `"admin"`) into an account column. Audit trail only, never used for authorization.
- Now: `api/src/index.ts:1288` stores `linkedAccountIds(context)[0] ?? null`, and `setFeedbackStarred` accepts null.
- Rows written before #228 can still hold a non-account value. Expect zero or a handful, from admins without NEAR. An optional cleanup sets those to null.

### L2. The identity guard test skipped plugin schemas (Low, fixed in #228)

- Was: `api/tests/unit/schema-identity.test.ts` imported only `@/db/schema`, so `plugins/storage/src/db/schema.ts` wasn't checked for `user_id` or `session*` columns.
- Now: `plugins/storage/src/__tests__/schema-identity.test.ts` applies the same check to the storage schema. A future plugin will need its own copy of the test.

### L3. The Legion access hint checked only the primary account (Low, fixed in #228)

- Was: `getMyLegionAccess` passed `primaryAccountId` only, so the hint could say "no access" when a linked account held the SBT. Enforcement (`api/src/index.ts:1000`, `assertLegionAccess(round, accountId, ...)`) was already correct.
- Now: `api/src/index.ts:948-952` calls `getMyAccessAcross` over every linked account (`api/src/services/legion-access.ts`) and reports the holder.

### L4. The rounds table compares one UI account with the round owner (Low, open)

- `ui/src/lib/use-near-account.ts:14-21,51,71` resolves a single account: the store's account, else `activeAccount`, else the `isPrimary` account from `auth.near.listAccounts()` (`:59`), else the first listed. `useNearAccountStatus` also returns every listed id as `accountIds`.
- `ui/src/components/rounds-table.tsx:92` builds the row CTA with `canJoin: ... && accountId !== round.ownerAccountId`, so it checks only that one account.
- Failure case: an owner creates a round as A, then makes linked account B active or primary. The table now shows "Join" on their own round. The server refuses the join (`api/src/index.ts:885`, which checks every linked account), so no data goes wrong, but the CTA is misleading.
- Fix: take `accountIds` from `useNearAccountStatus` as well (`rounds-table.tsx:76`) and check `!accountIds.includes(round.ownerAccountId)`. No migration.

## Not findings (checked)

- Round management: `resolveActor` (`api/src/index.ts:297-322`) carries `accountIds` from `linkedAccountIds`, and `actorOwnsAccount` (`api/src/services/round-access.ts:26`) matches any of them.
- Team delegation compares the auth `userId` against `listTeamMembers` through the auth plugin client (`api/src/services/team-access.ts:24-28`). This is a transient check through the auth plugin surface: nothing is stored and the auth DB isn't read. The new auth DB must keep team membership keyed on the same user, but nothing in this repo changes for that.
- Joined rounds, joining and posting (`api/src/index.ts:867,916,959,973-993`), feedback visibility and notes (`:1105,1117`), and the notifications inbox (`:1051`) all use `linkedAccountIds`.
- The org API key path acts as its organization and stores nothing per user (`api/src/index.ts:302-306`).
- No code in `api/`, `plugins/` or `ui/` reads the `near_accounts` table or an auth database URL. The UI reads accounts only through the auth client (`ui/src/lib/auth.ts:102-123`, `auth.near.listAccounts()`). It does use the `isPrimary` flag from that response to pick a single account (`ui/src/lib/use-near-account.ts:19`), and one comparison relies on that single account: see L4.

## Proposed fix tickets

Not filed. The user decides which to open.

| # | Title | Severity | Migration / backfill | Status |
| --- | --- | --- | --- | --- |
| 1 | storage: resolve the uploader across all linked accounts (confirm, delete, attach, delete-by-owner), and cover banners and images an org manager sets or removes | Medium | No | Open. Needs a design for how server-side calls name the account set, and a server-only delete-by-owner for the manager case |
| 2 | Star feedback: never write an auth user id into `starred_by_account_id` | Low | Optional: null out any non-account values written before #228 | Code fixed in #228; optional cleanup open |
| 3 | Extend the schema identity guard test to plugin schemas (storage, future plugins) | Low | No | Fixed in #228 (storage) |
| 4 | `getMyLegionAccess`: check every linked account and report which one holds the SBT | Low | No | Fixed in #228 |
| 5 | Rounds table: hide "Join" when any of the viewer's linked accounts owns the round (`accountIds`, not the single `accountId`) | Low | No | Open |
