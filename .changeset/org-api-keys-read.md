---
"api": minor
---

Organization API keys (`org_…`) can read their org's rounds and feedback — private included — read-only, over HTTP and `/api/mcp` (#111).

- **Reads**: an org key behaves as an org admin. It lists its organization's rounds in every status (pending and rejected included), reads all feedback of projects the org owns bypassing team delegation, and can open owner-only round data (credit candidates, participants). Projects owned by other organizations stay invisible.
- **Writes**: every write procedure refuses org keys with `FORBIDDEN: "Organization API keys are read-only"` instead of a generic auth error.
- Personal `api_…` keys are out of scope and remain denied.
