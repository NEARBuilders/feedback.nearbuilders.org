---
"api": patch
"ui": patch
---

A round past its end date is no longer treated as open outside the round page. Project rounds and a tester's joined rounds now include `endsAt`; the project directory, rounds table, feedback widget, project page and tester workspace stop offering to join or post in an expired round, and the owner dashboard's open-round count skips it.
