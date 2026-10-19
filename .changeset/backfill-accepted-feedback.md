---
"api": patch
---

Site admins can backfill `feedback.accepted` for resolved feedback that never reached activity (accepted before the outbox shipped) with `POST /activity-outbox/backfill-accepted`. Items that already have an event or an outbox row are skipped, so it is safe to run repeatedly.
