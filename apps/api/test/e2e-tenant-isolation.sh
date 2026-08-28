#!/usr/bin/env bash
# Cross-account attacker test (VibeArmor "log in as B, reach A's resources").
# Tester A eier et prosjekt + media + godkjent rapport + deling. Tester B prøver
# å nå A sine ressurser ved å bruke A sine ID-er. Alt skal 404/403, og A sine
# data skal være urørt etterpå.
#   Usage: bash test/e2e-tenant-isolation.sh   (from apps/api)
#   Requires: postgres 16 binaries, curl, jq.
set -u

API_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
PGPORT=55431
APIPORT=8091
TOKEN_A="tenant-a-token"
TOKEN_B="tenant-b-token"
ADMIN="admin-secret-for-test"
BASE="http://127.0.0.1:${APIPORT}"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | head -1)"
FAILURES=0

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null
  asPg "$PGBIN/pg_ctl" -D "$WORK/pg" stop -m immediate >/dev/null 2>&1
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

asPg() {
  if [ "$(id -u)" = "0" ]; then runuser -u pguser -- "$@"; else "$@"; fi
}
if [ "$(id -u)" = "0" ]; then
  id pguser >/dev/null 2>&1 || useradd -m pguser
  chown -R pguser "$WORK"
fi
asPg "$PGBIN/initdb" -D "$WORK/pg" -U docrai --auth=trust >/dev/null 2>&1 || { echo "initdb failed"; exit 1; }
asPg "$PGBIN/pg_ctl" -D "$WORK/pg" -o "-p $PGPORT -k $WORK -h 127.0.0.1" -l "$WORK/pg.log" start >/dev/null || { echo "pg start failed"; cat "$WORK/pg.log"; exit 1; }
asPg "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U docrai docrai_iso >/dev/null 2>&1

cd "$API_DIR"
DATABASE_URL="postgresql://docrai@127.0.0.1:${PGPORT}/docrai_iso" \
DATABASE_SSL=false \
TESTER_TOKEN="$TOKEN_A" \
ADMIN_SECRET="$ADMIN" \
PORT="$APIPORT" \
MEDIA_DIR="$WORK/media" \
STATIC_DIR="$WORK/no-static" \
node src/index.js >"$WORK/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf "$BASE/health" >/dev/null || { echo "API never became healthy"; cat "$WORK/api.log"; exit 1; }

# TOKEN_A seedes automatisk (TESTER_TOKEN). Provisjonér TOKEN_B via admin.
# CI-flake-vern: /health svarer før de idempotente CREATE TABLE-ene er ferdige,
# så det første DB-avhengige kallet kan treffe en halvferdig base. Retry (~5 s).
STATUS=""
for _ in $(seq 1 10); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/tokens" \
    -H "x-admin-secret: $ADMIN" -H 'Content-Type: application/json' \
    -d "{\"token\":\"$TOKEN_B\",\"tester_name\":\"Tenant B\"}")
  [ "$STATUS" = "201" ] && break
  sleep 0.5
done
check "provision token B (admin)" "201" "$STATUS"

# ── A eier: prosjekt + media + godkjent rapport + deling ─────────────────────
echo "evidence-A-$(date +%s)" > "$WORK/a.jpg"
MEDIA_A=$(curl -s -X POST "$BASE/api/media" -H "x-tester-token: $TOKEN_A" -F "file=@$WORK/a.jpg;type=image/jpeg" -F "projectId=projA" -F "kind=photo" | jq -r '.id')
check "A uploads media" "true" "$([ -n "$MEDIA_A" ] && [ "$MEDIA_A" != "null" ] && echo true)"

PROJ_A=$(jq -nc --arg m "$MEDIA_A" '{project:{id:"projA",name:"A sitt prosjekt",updatedAt:"2026-08-04T10:00:00Z",reportUrl:"https://docs.google.com/document/d/AAA111/edit",reportApproval:{approvedBy:"A",approvedAt:"2026-08-04T11:00:00Z"},reportDraft:{at:"t",content:{cause:"x"}},reportFinal:{at:"t",content:{cause:"x"}},notes:[{id:"n1",text:"t",photos:[{id:"p1",uri:"local",remoteId:$m}]}]}}')
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/projects/projA" -H "x-tester-token: $TOKEN_A" -H 'Content-Type: application/json' -d "$PROJ_A")
check "A upserts approved project" "200" "$STATUS"

SHARE_A=$(curl -s -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN_A" -H 'Content-Type: application/json' -d '{"projectId":"projA"}')
SHARE_A_ID=$(echo "$SHARE_A" | jq -r '.shareId')
check "A creates share" "true" "$([ -n "$SHARE_A_ID" ] && [ "$SHARE_A_ID" != "null" ] && echo true)"

# ── B ANGRIPER med A sine ID-er ──────────────────────────────────────────────
echo "--- B forsøker å nå A sine ressurser ---"
check "B cannot GET A's project" "404" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/projects/projA" -H "x-tester-token: $TOKEN_B")"

check "B's project list excludes A" "0" \
  "$(curl -s "$BASE/api/projects" -H "x-tester-token: $TOKEN_B" | jq '[.projects[] | select(.id=="projA")] | length')"

check "B cannot GET A's media" "404" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/media/$MEDIA_A" -H "x-tester-token: $TOKEN_B")"

check "B cannot share A's project" "404" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/share" -H "x-tester-token: $TOKEN_B" -H 'Content-Type: application/json' -d '{"projectId":"projA"}')"

check "B cannot download A's report" "404" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/projects/projA/download/pdf" -H "x-tester-token: $TOKEN_B")"

check "B cannot revoke A's share" "404" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/share/$SHARE_A_ID" -H "x-tester-token: $TOKEN_B")"

check "B cannot plant media in A's project" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/media" -H "x-tester-token: $TOKEN_B" -F "file=@$WORK/a.jpg;type=image/jpeg" -F "projectId=projA" -F "kind=photo")"

# B forsøker å lese A sin rapporthovedbok (gjenopprettingsendepunktet er
# tenant-skopet: prosjekt-id-en er klientoppgitt, raden må filtreres på token)
asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_iso -q -c \
  "INSERT INTO report_generations (tester_token, project_id, doc_id, status) VALUES ('$TOKEN_A', 'projA', 'DOCA', 'success')"
check "B cannot read A's report ledger" "null" \
  "$(curl -s "$BASE/report/status/projA" -H "x-tester-token: $TOKEN_B" | jq -r '.latest')"
check "A can read own report ledger" "success" \
  "$(curl -s "$BASE/report/status/projA" -H "x-tester-token: $TOKEN_A" | jq -r '.latest.status')"

# B forsøker å slette A sitt prosjekt (skopet delete skal ikke røre A sin rad)
curl -s -o /dev/null -X DELETE "$BASE/api/projects/projA" -H "x-tester-token: $TOKEN_B"

# ── A sine data skal være URØRT etterpå ──────────────────────────────────────
echo "--- A sine data skal overleve B sine forsøk ---"
check "A's project survived B's attacks" "A sitt prosjekt" \
  "$(curl -s "$BASE/api/projects/projA" -H "x-tester-token: $TOKEN_A" | jq -r '.project.name')"

check "A's media still readable by A" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/media/$MEDIA_A" -H "x-tester-token: $TOKEN_A")"

check "A's share still active" "active" \
  "$(curl -s "$BASE/api/share/$SHARE_A_ID/meta" | jq -r '.state')"

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "TENANT-ISOLATION: all checks passed"
  exit 0
else
  echo "TENANT-ISOLATION: $FAILURES check(s) FAILED"
  exit 1
fi
