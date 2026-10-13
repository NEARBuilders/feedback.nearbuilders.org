---
"api": patch
"ui": patch
---

Deleting accepted feedback now takes its `feedback.accepted` score with it: an undelivered emit is cancelled and a delivered one is retracted. GET routes accept string path and query values, so `?limit=`, `?starred=` and `/projects/{slug}/rounds/{number}` work over plain HTTP. Profile activity labels `feedback.accepted`, and the README documents endpoints under `/api`.
