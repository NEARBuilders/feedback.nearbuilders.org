# Feedback Rounds Service

`feedback.nearbuilders.org` is a standalone service for project-requested product testing rounds. A project owner requests a round on their product, builders sign up to test it, the project picks who they want, testers use the product and submit feedback during a set window, and when the round closes the selected testers get credit on their NEAR Builders profile.

This repository extends [`dev.everything`](https://everything.dev/) with local UI and API overrides. It is currently an initialized application scaffold; the feedback-rounds features described below are the implementation scope, not a claim that they are already live.

The product scope comes from [NEAR Builders issue #221](https://github.com/NEARBuilders/nearbuilders.org/issues/221) and its linked [build scope](https://nearbuilders.org/projects/scope/feedback-rounds-build-scope-qgsqd6). The service follows the `citynode.app` pattern: its own API, reached from a button on the project-owner dashboard in `nearbuilders.org` — not a tab in the main navigation.

## Why this exists

Projects in the NEAR Builders directory ship things and have no easy way to get real users to test them. Builders on the site want to try things, break them, and report what is wrong, but there is no place today that connects the two sides. Right now it happens in Telegram DMs, or not at all.

Feedback Rounds is matchmaking plus a paper trail: a project posts what it needs tested, builders apply, the project selects testers, testers report back, and the round produces a durable record of who contributed.

## Product principles

- **Human-judged.** The project owner selects testers and marks who contributed meaningfully. Nothing is automatic.
- **The project owns its issue tracker.** Bugs are filed on the project's own GitHub. This service never mirrors or rebuilds an issue tracker.
- **No pasted links for GitHub credit.** When credit needs to reflect issues filed, it is pulled from the GitHub API by repository and contributor.
- **Time-boxed.** Every round has a start and end date. Signups lock once the tester slots are full.
- **Not first come first served.** Applying is an expression of interest; the project chooses.
- **Portable credit.** Participation shows on the builder's NEAR Builders profile — which round, which project, and what they submitted.
- **No money, no scoring.** No payments or rewards handling, and no quality scoring of feedback.

## Planned API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/rounds` | Request a feedback round for a project you own. Enters the admin review queue. |
| `GET` | `/api/v1/rounds` | List rounds, filtered by status (open rounds are public and need no sign-in). |
| `GET` | `/api/v1/rounds/{id}` | Read one round. Pending and rejected rounds are visible only to the owner and admins. |
| `GET` | `/api/v1/rounds/pending` | Admin: list rounds awaiting review. |
| `POST` | `/api/v1/rounds/{id}/approve` | Admin: approve a round so it goes live for signups. |
| `POST` | `/api/v1/rounds/{id}/reject` | Admin: reject a round, with an optional reason. |
| `POST` | `/api/v1/rounds/{id}/signups` | Apply to test a round, with a short note. Once per builder per round. |
| `DELETE` | `/api/v1/rounds/{id}/signups/me` | Withdraw your own application. |
| `GET` | `/api/v1/rounds/{id}/signups` | Owner: list applicants for a round. |
| `PATCH` | `/api/v1/rounds/{id}/signups/{signupId}` | Owner: select or decline an applicant, until the slots are full. |
| `POST` | `/api/v1/rounds/{id}/submissions` | Selected tester: submit written feedback or a recorded-session link. |
| `GET` | `/api/v1/rounds/{id}/submissions` | Owner: read the in-app feedback for a round. |
| `GET` | `/api/v1/rounds/{id}/github-issues` | Read issues filed on the round's repo during its window, grouped by contributor. |
| `POST` | `/api/v1/rounds/{id}/close` | Owner: close the round and mark who contributed meaningfully. |
| `GET` | `/api/v1/builders/{accountId}/rounds` | Public: completed rounds a builder was credited on, for their profile. |

### Round lifecycle

```text
pending ──approve──▶ open ──slots fill──▶ in_progress ──owner closes──▶ closed
   │
   └──reject──▶ rejected
```

- A request starts as `pending` and is only visible to its owner and admins.
- On approval it becomes `open` and is listed publicly for signups.
- When the last tester slot is filled the round auto-locks: no more applications are accepted, and any still-pending applications are politely closed out.
- The owner closes the round from `open` or `in_progress`; closing writes the credit records.

### Feedback formats

The project chooses one or more formats when requesting a round:

- **GitHub issues** — filed on the project's own repository. Credit is pulled from the GitHub API by repo and contributor within the round's window. Only real `github.com/.../issues/...` items count.
- **Written feedback** — submitted in the app by a selected tester.
- **Recorded session** — a link submitted in the app by a selected tester.

## User flows

### Project owner

1. Opens Feedback Rounds from the button on their project's dashboard.
2. Fills in the request: which project, what needs testing, which feedback formats, number of testers, start and end date, what testers get, and anything not to touch or discuss publicly.
3. Waits for the request to be approved.
4. Reviews applicants and selects the ones they want; declines the rest.
5. Waits while selected testers work.
6. Closes the round and marks who contributed meaningfully.

### Builder / tester

1. Browses the open rounds — what is being tested, the window, and what testers get.
2. Applies to one with a short note about why they are a fit. One application per round.
3. If selected: tests the product, files issues on the project's GitHub, and submits any written feedback or recorded-session links in the app.
4. Their profile shows the completed round: the round name, the project, and what they submitted.

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

No application plugins are imported in this scaffold yet.

## Out of scope for the initial release

- Another issue tracker
- A tab in the `nearbuilders.org` main navigation
- Automatic tester selection
- Payment or rewards handling
- Quality scoring of feedback

## Success measures

- A project owner can request a round, have it approved, receive signups, select testers, receive feedback in the formats they chose, close the round, and the selected testers see it on their profile afterwards.
- The end-to-end walkthrough works on the live preview: a project owner posts a two-tester request, an admin approves it, two builders apply, the owner picks one and declines the other, the selected builder files issues and submits feedback, the owner marks the round complete, and the builder's profile then shows the round with links to their issues.

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
