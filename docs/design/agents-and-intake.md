# Agents and intake: design notes (#296, #298, #300)

These three issues change who may write to a round, or add a new intake path. Each one needs
a product decision, so this note proposes a default and says exactly where the change goes.
#296 is implemented, #298 is investigated and pinned with tests, and #300 has its no-model first step built. See each section.

## #296 Agents resolve, dismiss and star feedback

**Status: implemented** as described below, with one change: suggestions live in their own
`feedback_suggestions` table (migration 0031) rather than extra columns on `round_feedback`, so
every existing read and write path is untouched. Endpoints: `POST` and `GET
/rounds/{id}/suggestions`, `POST /rounds/{id}/suggestions/clear`. The inbox shows them under
"Suggested by your agent".

**Today.** Organization keys (`org_…`) are read-only. Access is decided in one place, the
round-access actor, so HTTP and MCP refuse every write with
`FORBIDDEN: Organization API keys are read-only`.

**Recommended default: suggest, then a person approves.**
- Add a nullable `suggested_status` (`resolved | dismissed | starred`) and `suggested_note` on a
  feedback item, writable by an organization key and nothing else.
- The manage inbox shows the suggestion and a one-click accept or reject. Only a signed-in
  member can change the real status, so credit and tester notifications stay human-driven.
- Log the key id on every suggestion.

**Why not a write scope.** Resolving or dismissing feeds tester credit (#118) and notifies the
tester. A leaked read key would become a way to quietly dismiss feedback.

**Where.** `api/src/db/schema.ts` (new columns and a migration), `api/src/contract.ts`
(`suggestFeedbackStatus`), the round-access actor, and the inbox in
`ui/src/routes/_authenticated/_dashboard/manage/$slug/$n/_inbox`. Update `ui/public/skill.md`.

**Test plan.** An org key can suggest but not resolve. A key for another organization is denied.
Accepting a suggestion behaves exactly like a manual resolve.

## #298 A tester's agent joins a round and posts

**Status: guard and rate limit added; live-host confirmation still pending (#322).** Join and post
now go through a tester-key guard (`api/src/services/tester-key.ts`): a key the host attached no
user to is refused with a message that says whether it is an organization key (`keyKind:
"organization"`) or has no user (`keyKind: "no-user"`), and personal keys are limited to 30 joins
and 30 posts a minute per user. Run `scripts/check-tester-key.sh` with a real personal key to see
which case the host produces, then record the result here and on #298.

**Earlier status: investigated, no auth change made.** `joinRound` and `postFeedback` use `requireAuth`,
which only needs `context.user` and `context.userId`: it never checks that the caller came from a
browser session. So a personal `api_…` key already works **if the host attaches the key owner's
user to the request**. That is decided by the host and the auth plugin, not this repo, so it
could not be confirmed here. Organization keys carry no user and are already refused with
`UNAUTHORIZED`. `tests/integration/tester-api-keys.test.ts` pins both behaviors: a personal-key
shaped caller with a linked NEAR account can join and post; an org key can't do either.

What's left is to confirm against the live host with a real personal key, then document it in
`skill.md`. Rate limits for automated testers are still undecided.

**Today.** `joinRound` and `postFeedback` use `requireAuth` (a session). The tester path needs a
linked NEAR account, which an organization key never has.

**Recommended default: personal keys only.**
- Let personal `api_…` keys call `joinRound` and `postFeedback` by moving them to
  `requireAuthOrApiKey`, and require the key's user to have a linked NEAR account, exactly as
  the UI does.
- Organization keys must stay refused on both: they can read their own round, not take part in
  it, and members of the owning organization can't join their own round.
- Keep every existing check: open rounds only, Legion gate, round end date, text limit.

**Open risk.** The middleware lives in the auth plugin and leaves the context untyped for
key-based access (see the comment near `requireAuthOrApiKey` in `api/src/index.ts`). Confirm what
`linkedAccountIds(context)` returns for a personal key before changing anything, and add rate
limits so an agent can't flood a round.

**Test plan.** A personal key with a linked account can join and post. The same key without a
linked account gets the "Link a NEAR account" error. An `org_…` key is refused on both.

**Decisions taken for #298.**
- Testers may use the API and MCP with a **personal `api_` key only**. Organization keys stay
  read-only and are refused with a message that names them.
- The key's owner must have a linked NEAR account, and every UI rule applies unchanged: open
  rounds only, one account's credit, no members of the owning or partner organizations, the
  Legion gate and the round end date.
- Abuse handling: 30 joins and 30 posts a minute per user, `TOO_MANY_REQUESTS` beyond that. Credit
  and the quality rules are unchanged, so low-effort automated posts earn nothing extra and owners
  can dismiss them like any other feedback.
- Still to confirm on the live host: that a personal key carries its owner's user.

## #300 Chat-style intake

**Status: first step built, the agent chat is not.** "Report an issue" in the widget now asks
three short questions (what were you trying to do, what happened, what did you expect) and
composes them into a structured report. Only "what happened" is required, and the tester can
switch to one free box. No model is involved and the tester writes every word. The agent
follow-up described below still needs a provider, a cost owner and an authorship rule.

**Today.** The composer takes written text (with pasted images) or a recorded-session link.

**Recommended default: don't build a chat yet.** Two cheaper steps get most of the value:
1. The widget's "type of feedback" choice plus the attached page details (#299) already give
   owners structure.
2. Put the questions in the round readme, where the tester sees them before writing.

If a chat is still wanted: the agent asks two or three follow-ups and drafts the report, the
tester edits and posts it as their own text, and the stored feedback format does not change.
This needs a model provider, a cost owner, and a rule that the tester stays the author for
credit. Decide those first.
