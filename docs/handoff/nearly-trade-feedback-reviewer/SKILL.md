---
name: nearly-trade-feedback-reviewer
description: Review and triage unresolved tester feedback for the NEARLY.TRADE round on feedback.nearbuilders.org, using a read-only org API key over MCP or REST. Use when asked to review, summarize, triage, cluster, or report on round feedback, or to check tester coverage.
---

# NEARLY.TRADE feedback reviewer

You help the NEARLY.TRADE team review tester feedback collected on
feedback.nearbuilders.org. Your credential is an **organization API key** —
it can read everything on the team's rounds but **cannot write anything**.
Status changes (resolve / dismiss / star) happen in the manage UI, not here.

## Connection

- Endpoint: `https://feedback.nearbuilders.org/api/mcp` (MCP, streamable HTTP)
  or the plain REST API under `https://feedback.nearbuilders.org/api/...`
- Auth on every request: header `x-api-key: <ORG_KEY>`
- The key looks like `org_…` and belongs to the nearly-trade organization.
- If requests return 401, the key was revoked or replaced — ask the org owner
  for a fresh one from https://feedback.nearbuilders.org/orgs/nearly-trade (API Keys tab).

## Round coordinates

- Project slug: `NEARLY.TRADE`, round number: `1`
- Round id: `0c955080-c044-42dd-bc5d-fb22bba70aeb`
- Manage UI: https://feedback.nearbuilders.org/manage/NEARLY.TRADE/1

For future rounds, resolve the id instead of hardcoding it:

```
POST /api/mcp   { "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "getRoundBySlug", "arguments": { "slug": "NEARLY.TRADE", "number": 1 } } }
```

MCP is JSON-RPC over HTTP: every call is a `tools/call` with header
`Accept: application/json, text/event-stream`; the result JSON arrives as an
SSE `data:` line. Tools mirror the REST API one-to-one (`listFeedback` ⇔
`GET /rounds/{id}/feedback`).

## Reading feedback

All unresolved submissions in one call:

```
GET /api/rounds/0c955080-c044-42dd-bc5d-fb22bba70aeb/feedback?status=unresolved&limit=100
x-api-key: <ORG_KEY>
```

- Items come newest-first with `authorAccountId`, `body` (markdown), `format`,
  `createdAt`, `starred`, `status`.
- Prefer REST for full bodies; MCP tool output can truncate very long text.
- Other filters: `status=resolved|dismissed`, `author=<accountId>`,
  `starred=true`, plus `cursor`/`limit` paging.
- One submission: `GET /api/rounds/{id}/feedback/{feedbackId}`.
- Tester coverage (who posted, how much, linked Telegram):
  `GET /api/rounds/{id}/feedback/authors` (MCP: `listFeedbackAuthors`).
- Participants vs submitters tells you reach: `GET /api/rounds/{id}/participants`.
- If the round links GitHub issues: `GET /api/rounds/{id}/github-issues`.

## Review workflow

1. **Pull everything** unresolved in one call (the round rarely exceeds 100).
2. **Cluster by product area** — the round covers Keys, Swarm, Wiki, Checkout,
   and Agents on nearly.trade. Tag each submission with its area(s).
3. **Extract findings, not prose** — each submission is a tester's session log.
   Pull out: what they did, what broke, what confused them, what they loved.
4. **Dedupe across testers** — the same bug reported by three testers is one
   P0 with three data points, not three bugs. Count occurrences.
5. **Severity**: blockers (flows that dead-end), then broken behavior, then
   confusion/onboarding, then polish and feature requests.
6. **Flag slop** — the round rules say AI slop submissions are rejected and
   disqualified. Generic, non-specific, or clearly untested submissions should
   be listed separately for dismissal in the UI.
7. **Produce the report**: an executive summary (top 5 issues by impact), the
   clustered findings with counts and tester handles, quick wins, and a
   "dismiss as slop" list. Reference submissions by author + date.
8. **Hand off status changes**: you cannot resolve/dismiss/star with this key.
   Give the team a checklist (submission author + suggested status) to apply
   at https://feedback.nearbuilders.org/manage/NEARLY.TRADE/1.

## Ground rules

- **This feedback is private.** Never post submissions, tester handles, or
  excerpts outside the team. Summaries stay internal unless the owner shares them.
- **Testers earn credits** from resolved feedback — be careful with dismissals;
  when in doubt, leave it unresolved and ask the owner.
- The round's `endsAt` gates new submissions, not your review. Closing the
  round and assigning winners/credits happens in the manage UI by the owner.
- Never attempt writes with this key — every write returns
  `FORBIDDEN: Organization API keys are read-only`. That's the design.
