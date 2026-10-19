---
"api": patch
---

Speed up the Legion holder check: query the Legion contracts in parallel against FastNEAR's public RPC, abort NEAR RPC calls after 5s, and only log "denying access" when access is actually denied.
