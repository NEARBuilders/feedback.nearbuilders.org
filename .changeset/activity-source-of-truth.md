---
"api": minor
"ui": minor
---

Activity as the sole source of tester standing, registry-backed project identity, and one URL per round.

- **Reputation**: the local points ledger is gone. Tester standing is read from activity.nearbuilders.org (`getBuilderStanding`, `getLeaderboard`), `feedback.accepted` is emitted through a durable transactional outbox when an owner resolves feedback, and un-accepting now also cancels emits parked after failed retries so a late retry can never deliver a stale event. Failed rows are inspectable and retryable by site admins at `/activity-outbox/failed`, `/activity-outbox/failed/retry`, and `/activity-outbox/depth`.
- **Project identity**: projects and rounds carry identity (domain, repository, logoUrl) resolved in batch from the nearbuilders.org registry, surfaced as directory cards, a "open the product" round CTA, and project-led /rounds rows. Depends on nearbuilders.org#265 (batch `?slugs=` lookup, `logoUrl`, `limit` coercion); identity stays null until that ships.
- **Rounds**: one URL per round — `/projects/$slug/$n` adapts to the viewer, with a "your feedback" submit tab; `/testing/$slug/$n` is gone. Round creation collapses into `/manage/new` (`?project=`, `?from=`), and `/dashboard` is a two-card overview with per-role counters via `getOwnerSummary`.
- **Cleanup**: the dead tenants subsystem (routes, service, queries) and assorted unused UI primitives were removed; unauthenticated `GET /errors` now requires site-admin; Nostr/GitHub/tip-template secrets are declared in `bos.config.json`.
