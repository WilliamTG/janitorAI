#!/usr/bin/env bash
# E2E-test av per-tester rate limiting på de tunge KI-endepunktene.
# Kjører uten Postgres (env-fallback-auth) med HEAVY_RATE_LIMIT=2 så limiteren
# kan trippes med tre kall i stedet for 31.
# Usage: bash test/e2e-rate-limit.sh   (from apps/api)
set -u

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
APIPORT=8093
TOKEN="e2e-rl-token"
BASE="http://127.0.0.1:${APIPORT}"
FAILURES=0

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

check() { # check <name> <expected> <actual>
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1 — expected [$2], got [$3]"
    FAILURES=$((FAILURES + 1))
  fi
}

cd "$API_DIR"
TESTER_TOKEN="$TOKEN" \
PORT="$APIPORT" \
HEAVY_RATE_LIMIT=2 \
MEDIA_DIR="$WORK/media" \
STATIC_DIR="$WORK/no-static" \
node src/index.js >"$WORK/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do
  curl -sf "$BASE/health" >/dev/null 2>&1 && break
  sleep 0.25
done

hit_transcribe() {
  curl -s -o "$WORK/body.json" -w "%{http_code}" -X POST "$BASE/transcribe" \
    -H "x-tester-token: $TOKEN" -H "Content-Type: application/json" -d '{}'
}

# ── Per-token-bøtta: to kall slipper gjennom limiteren, det tredje stoppes ───
check "heavy call 1 passes limiter (400 No file)" "400" "$(hit_transcribe)"
check "heavy call 2 passes limiter (400 No file)" "400" "$(hit_transcribe)"

STATUS3="$(hit_transcribe)"
check "heavy call 3 is rate limited" "429" "$STATUS3"
check "429 body carries code RATE_LIMITED" "RATE_LIMITED" "$(jq -r '.code // empty' "$WORK/body.json")"
RETRY_BODY="$(jq -r '.retryAfterSeconds // 0' "$WORK/body.json")"
check "429 body carries positive retryAfterSeconds" "yes" "$([ "$RETRY_BODY" -gt 0 ] 2>/dev/null && echo yes || echo no)"
RETRY_HEADER="$(curl -s -o /dev/null -D - -X POST "$BASE/transcribe" \
  -H "x-tester-token: $TOKEN" -H "Content-Type: application/json" -d '{}' \
  | tr -d '\r' | awk -F': ' 'tolower($1)=="retry-after" {print $2}')"
check "429 sets Retry-After header" "yes" "$([ -n "$RETRY_HEADER" ] && [ "$RETRY_HEADER" -gt 0 ] 2>/dev/null && echo yes || echo no)"

# ── Bøtta deles på tvers av tunge endepunkter for samme tester ───────────────
DESCRIBE_STATUS="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/describe-image" \
  -H "x-tester-token: $TOKEN" -H "Content-Type: application/json" -d '{}')"
check "describe-image shares the per-tester bucket" "429" "$DESCRIBE_STATUS"

# ── Auth kjører før limiteren: ugyldig token gir 401, brenner ikke kvote ─────
WRONG_STATUS="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/transcribe" \
  -H "x-tester-token: not-the-token" -H "Content-Type: application/json" -d '{}')"
check "invalid token is 401, not 429" "401" "$WRONG_STATUS"

# ── Offentlig flate uten token nøkles per IP — egen bøtte, egne to kall ──────
demo() { curl -s -o /dev/null -w "%{http_code}" "$BASE/api/demo/underlag"; }
check "public demo call 1 unaffected by token bucket (400 adresse kreves)" "400" "$(demo)"
check "public demo call 2 still under IP bucket" "400" "$(demo)"
check "public demo call 3 rate limited on IP key" "429" "$(demo)"

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "$FAILURES check(s) failed"
  tail -20 "$WORK/api.log"
  exit 1
fi
echo "All rate-limit checks passed"
