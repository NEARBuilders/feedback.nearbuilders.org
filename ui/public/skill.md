# Feedback review skill — for round owners and partners

Organizations that own a feedback round — or hold a partnership grant on it —
can mint a read-only **organization API key** to review their rounds' feedback
with an agent. Personal `api_…` keys also work but are never read-only;
prefer an org key.

## 1. Mint an organization API key

An org owner or admin: sign in → /orgs/<your-org-slug> → API Keys tab → create.
The key starts with `org_` and is shown once — store it.

Organization keys are **read-only by design**: every write (resolving or
dismissing feedback, starring, setting winners, closing the round) is refused
with `FORBIDDEN: Organization API keys are read-only`. Those actions happen
in the manage UI by signed-in org members. The one exception is leaving
suggestions for a member to accept (see "Suggest, don't decide").

## 2. Connect

- MCP: POST https://feedback.nearbuilders.org/api/mcp
  (JSON-RPC over HTTP; send `Accept: application/json, text/event-stream`,
  the result arrives as an SSE `data:` line)
- REST: https://feedback.nearbuilders.org/api/... (preferred for full text)
- Auth on every request: header `x-api-key: <your org key>`

## 3. Find your round

MCP tool `getRoundBySlug { slug: "<project-slug>", number: <n> }` → note `id`.
Your project slug is the path segment of your round page.

## 4. Read feedback

GET /api/rounds/<roundId>/feedback?status=unresolved&limit=100

- Newest first; each item has `authorAccountId`, `body` (markdown), `format`,
  `createdAt`, `starred`, `status`.
- Other filters: `status=resolved|dismissed`, `author=<accountId>`,
  `starred=true`; page with `cursor`/`limit`.
- Tester coverage: GET /api/rounds/<roundId>/feedback/authors
- Reach: GET /api/rounds/<roundId>/participants

## 5. Review workflow

1. Pull everything unresolved in one call.
2. Cluster findings by product area; extract what broke, what confused, what they loved.
3. Dedupe across testers — one bug reported three times is one finding with three data points.
4. Rank: blockers → broken behavior → confusion → polish.
5. Flag AI-slop submissions separately (rounds disqualify them).
6. Produce a report: top issues by impact, clustered findings with counts and
   tester handles, quick wins, and a suggested status per submission.
7. Leave your suggested statuses for a human to accept (see below), or hand them the
   checklist — they apply resolve/dismiss/star at /manage/<project-slug>/<n>.

## Suggest, don't decide

Org keys can't resolve, dismiss or star, but they can leave suggestions:

POST /api/rounds/<roundId>/suggestions
{ "suggestions": [
  { "feedbackId": "<id>", "status": "resolved" | "dismissed", "star": true, "note": "why" }
] }

- Send `status`, `star: true`, or both. A note is optional (up to 1000 characters).
- One suggestion per item: a new one replaces the old.
- Nothing changes until a signed-in member accepts it. The owner sees them under
  "Suggested by your agent" at the top of the inbox and can accept or reject each one.
- A suggestion is dropped once the item is resolved, dismissed or starred another way.
- Read pending suggestions with GET /api/rounds/<roundId>/suggestions.
- The key that made each suggestion is recorded.

## Ground rules

- Round feedback is private. Keep submissions, tester handles, and excerpts
  inside the team.
- Testers earn credits from resolved feedback — dismiss carefully.
- If the key stops working (401), ask an org owner to mint a new one.
