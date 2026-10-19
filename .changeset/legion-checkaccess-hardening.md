---
"api": patch
---

Harden the public Legion `checkAccess` route: reject malformed or oversized account ids, share RPC calls between concurrent checks for one account, and cap the holder cache so random account ids can't grow it without bound.
