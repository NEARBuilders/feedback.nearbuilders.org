#!/usr/bin/env bash
# Checks what the live host does with a personal api_ key as a tester (#322, #298).
#
#   scripts/check-tester-key.sh <api_key> [org_key] [round-id] [host]
#
# Pass a throwaway personal key. It joins the round and posts one clearly marked test
# message, so use a round you own or a test round. Without a round id it only checks
# identity handling. Org key is optional; with it the script confirms org keys are refused.
set -u
KEY="${1:?personal api_ key}"
ORG_KEY="${2:-}"
ROUND="${3:-}"
HOST="${4:-https://feedback.nearbuilders.org}"
API="$HOST/api"
OUT=$(mktemp)

call() { # method path key [json]
  curl -sS -o "$OUT" -w "%{http_code}" -X "$1" "$API$2" \
    -H "x-api-key: $3" -H "content-type: application/json" ${4:+-d "$4"}
}

echo "host: $HOST"
echo
echo "1. personal key reads open rounds"
echo "   GET /rounds -> $(call GET /rounds "$KEY")"

if [ -n "$ROUND" ]; then
  echo
  echo "2. personal key joins round $ROUND"
  code=$(call POST "/rounds/$ROUND/join" "$KEY" '{}')
  echo "   POST join -> $code  $(head -c 300 "$OUT")"
  echo "   keyKind in the body tells you what the host did: 'no-user' means the key has no user."

  echo
  echo "3. personal key posts feedback"
  code=$(call POST "/rounds/$ROUND/feedback" "$KEY" '{"format":"written","body":"Automated check of tester API keys (#322). Safe to dismiss."}')
  echo "   POST feedback -> $code  $(head -c 300 "$OUT")"
  echo "   Then open the round's inbox: the post should show your account, and your standing should move."
fi

if [ -n "$ORG_KEY" ] && [ -n "$ROUND" ]; then
  echo
  echo "4. org key must be refused"
  code=$(call POST "/rounds/$ROUND/join" "$ORG_KEY" '{}')
  echo "   POST join -> $code (expect 401) $(head -c 200 "$OUT")"
  code=$(call POST "/rounds/$ROUND/feedback" "$ORG_KEY" '{"format":"written","body":"org key check"}')
  echo "   POST feedback -> $code (expect 401)"
fi
rm -f "$OUT"
