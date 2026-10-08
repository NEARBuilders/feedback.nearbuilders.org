# Feedback Rounds Service

`feedback.nearbuilders.org` is a standalone service for project-requested product testing rounds. A project owner requests a round on their product, any builder can join it and try the product, testers post feedback while the round is open, and when the owner closes the round the testers they mark as meaningful contributors get credit on their NEAR Builders profile.

This repository extends [`dev.everything`](https://everything.dev/) with local UI and API overrides, implementing the feedback-rounds features described below.

The product scope comes from [NEAR Builders issue #221](https://github.com/NEARBuilders/nearbuilders.org/issues/221) and its linked [build scope](https://nearbuilders.org/projects/scope/feedback-rounds-build-scope-qgsqd6). The service follows the `citynode.app` pattern: its own API, reached from a button on the project-owner dashboard in `nearbuilders.org` — not a tab in the main navigation.

## Why this exists

Projects in the NEAR Builders directory ship things and have no easy way to get real users to test them. Builders on the site want to try things, break them, and report what is wrong, but there is no place today that connects the two sides. Right now it happens in Telegram DMs, or not at all.

Feedback Rounds is matchmaking plus a paper trail: a project posts what it needs tested, builders join and try it, testers report back, and the round produces a durable record of who contributed.

## Product principles

- **Human-judged.** The project owner marks who contributed meaningfully when closing the round, and resolves or dismisses feedback. Nothing is automatic.
- **The project owns its issue tracker.** Bugs are filed on the project's own GitHub. This service never mirrors or rebuilds an issue tracker.
- **No pasted links for GitHub credit.** When credit needs to reflect issues filed, it is pulled from the GitHub API by repository and contributor.
- **Open to join.** Any signed-in builder with a linked NEAR account can join an open round and leave again before it closes. There is no application queue or slot limit.
- **Portable credit.** Participation shows on the builder's NEAR Builders profile — which round, which project, and what they submitted.
- **No money.** No payments handling. Reputation comes from [activity.nearbuilders.org](#reputation), not from any quality scoring kept here.

## API

All endpoints are under `/api/v1`. Open rounds and leaderboards are public; everything else needs a signed-in session.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/rounds` | Request a feedback round for a project your active organization owns, with an optional markdown `readme` for testers. A new project is created `pending`; on an approved project the round opens immediately. |
| `GET` | `/rounds` | List rounds, filtered by status (open and closed rounds are public; pending and rejected are admin only). |
| `GET` | `/rounds/{id}` | Read one round. Pending and rejected rounds are visible only to the owning organization and admins. |
| `GET` | `/projects/{slug}/rounds/{number}` | Read a round by its readable address, e.g. `/projects/near-wallet/rounds/3`. |
| `PATCH` | `/rounds/{id}` | Owning organization: edit the round's markdown readme for testers and its feedback formats. |
| `DELETE` | `/rounds/{id}` | Owning organization: delete a round. |
| `GET` | `/projects` | Admin: list projects, optionally by status (the approval queue is `status=pending`). |
| `GET` | `/projects/mine` | List your active organization's projects with approval status and any rejection reason. |
| `GET` | `/projects/approved` | Public: approved projects with their rounds. |
| `GET` | `/projects/{slug}/detail` | Public: a project, its rounds and its identity from the nearbuilders.org registry (domain, logo, description). |
| `POST` | `/projects/{id}/approve` | Admin: approve a project; its pending rounds open. |
| `POST` | `/projects/{id}/reject` | Admin: reject a project with a required reason; its pending rounds are rejected with it. |
| `POST` | `/projects/{id}/managing-team` | Org owner or admin: delegate the project's rounds to a team (or clear it). |
| `POST` / `DELETE` | `/rounds/{id}/join` | Join an open round, or leave it. Members of the owning organization can't join. |
| `GET` | `/rounds/{id}/join` | Whether you have joined. |
| `GET` | `/rounds/joined` | Rounds you have joined. |
| `GET` | `/rounds/{id}/participants` | Participants, for the owner, admins and joined testers. |
| `POST` | `/rounds/{id}/invite` | Owner: notify the testers of an earlier round of the same project. |
| `POST` | `/rounds/{id}/feedback` | Joined tester: post written feedback or a recorded-session link while the round is open. |
| `GET` | `/rounds/{id}/feedback` | Read a round's feedback, newest first, cursor-paged and filterable by `status` and `author`. |
| `GET` | `/rounds/{id}/feedback/{feedbackId}` | One feedback item; owner notes are included for its author and the round's managers. |
| `POST` | `/rounds/{id}/feedback/{feedbackId}/notes` | Owner note on feedback, or the author's reply to one. |
| `GET` | `/rounds/{id}/my-feedback` | Tester: your feedback in a round, with status and notes. |
| `DELETE` | `/rounds/{id}/feedback/{feedbackId}` | Owning organization: remove a feedback item. |
| `PATCH` | `/rounds/{id}/feedback/status` | Owning organization or admin: resolve, dismiss or reopen feedback (bulk). |
| `POST` | `/rounds/{id}/broadcast` | Owning organization: send an in-app notification to the round's participants. |
| `GET` | `/notifications` | Your notifications; `POST /notifications/{id}/read` and `/notifications/read-all` mark them read. |
| `GET` | `/rounds/{id}/github-issues` | Read issues filed on the round's repo during its window, grouped by contributor. |
| `GET` | `/rounds/{id}/credit-candidates` | Owner: the builders who posted feedback and can be credited. |
| `POST` | `/rounds/{id}/close` | Owner: close the round and mark who contributed meaningfully. |
| `GET` | `/rounds/{id}/credits` | The credit records of a closed round. |
| `GET` | `/builders/{accountId}/rounds` | Public: completed rounds a builder was credited on, for their profile. |
| `GET` | `/builders/{accountId}/standing`, `/activity/leaderboard` | Public: one builder's rank and the leaderboard, both read from [activity.nearbuilders.org](#reputation). |
| `GET` | `/my/owner-summary` | Owner: open rounds, unresolved feedback and pending-approval projects across the active organization, for the dashboard overview. |

### Round lifecycle

```text
pending ──project approved──▶ open ──owner closes──▶ closed
   │
   └──project rejected──▶ rejected
```

- Rounds belong to a project, and a project belongs to the organization that first requested it. Admins approve a project once; there is no per-round approval.
- The request that creates a project carries its first round, which starts `pending` and is only visible to the owning organization and admins. Further rounds need an approved project and open immediately.
- Only the owning organization (or the team it delegated the project to) can manage a project's rounds: close, edit the readme, remove feedback, resolve or dismiss, delete. Projects that predate organization ownership are claimed by the creator of one of their rounds.
- On project approval its pending rounds become `open` and are listed publicly.
- Joining is open while the round is `open`. There is no application step, no tester selection and no slot limit, so there is no `in_progress` status.
- The owner closes the round from `open`; closing writes the credit records.

### Feedback formats

The project chooses one or more formats when requesting a round:

- **GitHub issues** — filed on the project's own repository. Credit is pulled from the GitHub API by repo and contributor within the round's window. Only real `github.com/.../issues/...` items count.
- **Written feedback** — posted in the app by a tester who joined the round.
- **Recorded session** — a link posted in the app by a tester who joined the round.

### Builder profile feed

`GET /api/v1/builders/{accountId}/rounds` is public and needs no sign-in. It returns the
closed rounds the builder holds a credit record on, newest first, for the "Feedback rounds"
section on their `nearbuilders.org` profile.

```jsonc
[
  {
    "roundId": "0f9e...",              // feedback.nearbuilders.org round id
    "roundTitle": "Try the onboarding flow",
    "projectSlug": "my-project",
    "repoUrl": "https://github.com/near/feedback", // round repo, or null
    "issuesUrl": "https://github.com/near/feedback/issues", // set only when the round collected GitHub issues, else null
    "contributedMeaningfully": true,   // the owner marked this builder as a meaningful contributor
    "summary": "Sharp bug reports",    // owner's note on the credit, or null
    "writtenCount": 2,                 // in-app written feedback posts by this builder
    "recordedCount": 1,                // in-app recorded-session links by this builder
    "closedAt": "2026-04-03T12:00:00.000Z",
    "creditedAt": "2026-04-03T12:00:00.000Z"
  }
]
```

An account with no credited closed rounds returns `[]`.

## Reputation

This app keeps no points ledger. `activity.nearbuilders.org` is the single source of a tester's
standing — the leaderboard, a builder's rank, and the "Earned credit" card on a profile all read
from it, with no local fallback. A reachability problem with the gateway shows up as an empty
leaderboard, not a locally-computed stand-in.

- `GET /api/v1/activity/leaderboard?period=weekly|monthly|all-time&limit=` is public and proxies
  activity's leaderboard for this app's Activity Source, unfiltered by event type — the gateway's
  own per-type scoring (see below) decides what counts, not this app.
- `GET /api/v1/builders/{accountId}/standing` is public and returns one builder's entry from that
  same all-time board — `{ accountId, rank, score, eventCount }`, or `null` if they have not
  scored yet.

### What this app emits

| Event type | Actor | When |
| --- | --- | --- |
| `round.opened` | round owner | a round is created or its project is approved |
| `feedback.posted` | feedback author | a written or recorded post is submitted |
| `feedback.accepted` | feedback author | the round owner marks a submission `resolved` |
| `round.closed` | round owner | the owner closes the round |
| `credit.awarded` | builder | the round owner marks them a meaningful contributor at close |

What each is worth is configured on the gateway for this app's Activity Source, not in this
codebase — see [NEARBuilders/activity.nearbuilders.org#66](https://github.com/NEARBuilders/activity.nearbuilders.org/issues/66)
for the live configuration and the reasoning behind it (`feedback.accepted` and `credit.awarded`
scored, `feedback.posted` and `round.opened`/`round.closed` not, so standing follows what a round
owner judged worth something, not raw submission volume).

### Delivery

`round.opened`, `round.closed` and `credit.awarded` are emitted best-effort
(`services/activity-events.ts`): a failed, rejected, or unreachable gateway is logged and
swallowed, and never blocks the local action that triggered it.

`feedback.accepted` is different, because it is the event the leaderboard actually depends on
with no local fallback to catch a loss. It goes through a durable outbox
(`services/activity-outbox.ts`, table `activity_outbox`) instead: the emit (or retraction, if an
owner un-accepts something) is written in the same transaction as the status change, and a
worker drains the queue against the gateway with exponential backoff. A gateway outage delays the
event; it does not lose it. Un-accepting something whose emit has not been delivered yet cancels
the queued row rather than emitting and immediately retracting it.

## Private rounds, Legion gating and stars

- **Private rounds:** a round can be marked private when it is requested, and managers can toggle
  it later (`PATCH /rounds/{id}/settings`). On a private round, submissions are readable only by
  the project's managing org or team (same rule as round management), platform admins, and each
  author for their own submission. `listFeedback` enforces this for the HTTP route, the feedback
  table export and the `/api/mcp` tool alike. Everyone else sees the round's public surface only:
  title, description, readme, participant count with three avatars and the submission count.
  Feedback on a private round is never published to Nostr (comments can't be retracted there), and
  its activity event carries the round title, never the body.
- **Legion-only rounds:** the owner can restrict a round to holders of a Legion SBT. Joining and
  posting are rejected for non-holders, a failed holder lookup counts as "not a holder", and the
  round page shows signed-in builders whether they are eligible before they try to join.
- **Round expiration:** the owner can set an expiration time when requesting a round and change or
  clear it later (`PATCH /rounds/{id}/settings`). Once it passes, joining and posting are blocked
  even though the round is still status `open` — the owner still closes it manually, since closing
  writes the credit records. The round page shows a live countdown while the clock runs.
- **Stars:** round managers (and admins) can star standout submissions
  (`PATCH /rounds/{id}/feedback/star`), independent of resolve/dismiss. Stars are curation today —
  they filter and badge the owner's inbox and the public feedback list — and are not yet scored
  by activity. A `feedback.starred` event is an open question on
  [activity.nearbuilders.org#66](https://github.com/NEARBuilders/activity.nearbuilders.org/issues/66);
  until the gateway configures one, starring something does not change anyone's standing.

## Organization API keys (read-only)

An organization API key (`org_…`, created from an organization's API Keys tab) is the
organization's own credential. Over HTTP and `/api/mcp` it can list its organization's rounds
(including its pending and rejected ones) and read their feedback, **including private
feedback**, for projects the organization owns. It behaves like an organization admin, so it
**bypasses team delegation**, and it is **read-only**: closing, resolving, dismissing, starring
and deleting are refused. A key is denied for projects owned by other organizations, and personal
`api_…` keys are not covered. Access is decided in one place (the round-access actor), so HTTP and
MCP behave identically.

## Feedback images

Images pasted or dropped into the feedback editor are uploaded to the storage plugin and live in
the feedback body as markdown. When the feedback is posted, the API links the images in its body
to the feedback (`attachByUrls`), and when the feedback is removed, or its round is deleted, it
deletes them again (`deleteByOwner`). Both calls are made as the feedback's author, because assets
belong to whoever uploaded them, and both are best effort: a storage failure is logged and never
blocks posting or removing feedback.

## Teams and delegated round management

Organizations can group members into teams and delegate a project's rounds to a team. Teams
themselves live in the shared auth plugin (`createTeam`, `listTeams`, `addTeamMember`, ...);
this app stores only which team manages which project.

- **Teams:** an organization's owners and admins create and delete teams and add or remove
  members on the organization page's **teams** tab.
- **Delegation:** on the same tab, owners and admins choose, per approved project, who manages
  its rounds: any organization member (the default) or one of the organization's teams.
  `POST /projects/{id}/managing-team` sets it (`teamId: null` clears it). The team must belong
  to the project's organization.
- **Who can manage a delegated project's rounds:** the team's members, and the organization's
  owners and admins. Everyone else in the organization is refused, and members of other
  organizations never gain access through a team.
- **Fails closed:** if the team membership lookup errors, access is denied rather than granted.
- **Deleting a team:** the teams tab first returns the active organization's projects that
  were delegated to it to "any organization member", then deletes the team. A delegation that
  still points at a deleted team (for example in an organization you are not currently
  acting in) shows as "Deleted team" and only owners and admins can manage those rounds
  until it is changed.
- **Unchanged:** projects with no delegation behave exactly as before, with no team lookup.

Not covered yet, because the shared auth plugin does not support them:

- Inviting by NEAR account, and inviting straight into a team: `inviteMember` takes only an
  email and a role.
- An active team per session: sessions have an active organization but no active team.

## Tipping testers on Telegram

Round managers can tip a tester from the feedback table. The tester's Telegram handle comes from
their `nearbuilders.org` builder profile (`links.telegram`) with a NEAR Social fallback
(`linktree.telegram`), normalized to a bare handle and shown next to the author, or "no Telegram
linked". The tip button copies the tip-bot message and opens a `t.me` link with it ready to send;
it is disabled with an explanation when no handle is linked. If both sources are unreachable the
lookup degrades to "unavailable" instead of failing.

`GET /api/v1/builders/{accountId}/telegram` (signed-in callers only) returns
`{ handle, source, available, message, shareUrl }`. The message comes from the
`TIP_MESSAGE_TEMPLATE` secret (default `/tip @{handle}`; `{handle}` and `{account}` are replaced),
so the bot's command format can change without a code change.

### Configuration

feedback.nearbuilders.org is an [Activity Source](https://github.com/NEARBuilders/activity.nearbuilders.org)
(id `feedback-rounds`) for `activity.nearbuilders.org`. This is a **producer integration** for
submission and a **read dependency** for standing — feedback keeps its own database for
everything else; there are no shared tables and no Nostr or Redis here.

| Env var | Purpose |
| --- | --- |
| `ACTIVITY_API_BASE_URL` | Activity API gateway base URL, e.g. `https://activity.nearbuilders.org/api` |
| `ACTIVITY_API_KEY` | Source API Key (`act_…`), a server-side bearer secret, required to emit |
| `ACTIVITY_SOURCE_ID` | This app's registered Activity Source id, scopes leaderboard/standing reads |

Leave `ACTIVITY_API_BASE_URL` and `ACTIVITY_API_KEY` blank to disable emission (the default in
local development and tests) — reads still work with just `ACTIVITY_API_BASE_URL` set, since
leaderboard/standing are public on the gateway. Registering the Activity Source and obtaining its
API key is a manual step against activity.nearbuilders.org's onboarding flow — register the
source id with all five event types above, bind a Signing Identity, then create the key and store
it in the deployment platform's secret manager. Never commit the key.

## User flows

### Project owner

1. Opens Feedback Rounds from the button on their project's dashboard.
2. Fills in the request: which project, what needs testing, which feedback formats, an optional repo link and an optional readme for testers.
3. Waits for the project to be approved (once per project; later rounds open right away).
4. Watches builders join, answers feedback by resolving or dismissing it, and can broadcast updates to participants.
5. Closes the round and marks who contributed meaningfully.

### Builder / tester

1. Browses the open rounds — what is being tested and in which formats.
2. Joins one (needs a linked NEAR account), and can leave again before it closes.
3. Tests the product, files issues on the project's GitHub, and posts any written feedback or recorded-session links in the app.
4. Earns activity credit for feedback the owner accepts, and their profile shows the completed round once credited: the round name, the project, and what they submitted.

### Admin

1. Reviews the queue of pending requests.
2. Approves a request to make it live, or rejects it with a reason.

## Initial delivery scope

- A browse page listing open rounds, with filter and search.
- A request form, visible only to people who own a project on the site, that lists only the projects the signed-in wallet actually owns.
- A round detail view where applying, selecting, declining, and submitting feedback all happen.
- An admin approval queue.
- A "Feedback rounds" section on builder profiles showing credited rounds and what the builder submitted, with issues linked to GitHub.
- The plumbing: storage, permission rules, the automatic state transitions, and the GitHub issue read path.
- A button on the `nearbuilders.org` project-owner dashboard that opens this service.

## Out of scope for the initial release

- Another issue tracker
- A tab in the `nearbuilders.org` main navigation
- Automatic tester selection
- Payment or rewards handling
- Quality scoring of feedback

## Success measures

- A project owner can request a round, have it approved, let builders join, receive feedback in the formats they chose, close the round, and the testers they credited see it on their profile afterwards.
- The end-to-end walkthrough works on the live preview: a project owner requests a round, an admin approves the project, two builders join, they file issues and post feedback, the owner resolves it and closes the round crediting the meaningful contributors, and their profiles then show the round with links to their issues.

## Local development

### Requirements

- [Bun](https://bun.sh/)
- Docker with Compose

### Start the project

```bash
bun install
docker compose up -d --wait
bun run dev
```

The initializer creates a local `.env` from `.env.example`. Keep secrets out of version control.

### Useful commands

```bash
bun run typecheck
bun run test
bun run lint
bun run build
```

Runtime composition is configured in [`bos.config.json`](./bos.config.json). The project publishes from `nearbuilding.near`, serves `feedback.nearbuilders.org`, and inherits the shared runtime from `dev.everything` while overriding the UI and API locally.

## Repository layout

```text
api/               Feedback Rounds API and service implementation
ui/                Browse, round detail, request form, and admin queue UI
bos.config.json    everything.dev runtime composition
docker-compose.yml Local infrastructure
```

See [`AGENTS.md`](./AGENTS.md) for project-specific development guidance and [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the contribution workflow.
