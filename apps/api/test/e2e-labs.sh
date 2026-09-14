#!/usr/bin/env bash
# E2E for the Labs prompt-iteration surface.
#
# Covers what the unit tests cannot: that the new SCHEMA_SQL is valid against a
# real Postgres, that the fixture loads into benchmark_cases on boot, that the
# admin-secret guard applies to every Labs route, and that a run request fails
# cleanly rather than half-writing when the AI engine is absent.
#
# Deliberately does NOT call Gemini — this asserts plumbing and guards, not
# model output.
#
#   cd apps/api && bash test/e2e-labs.sh
set -u

PASS=0; FAIL=0
ok()   { echo "ok   $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL $1"; FAIL=$((FAIL+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$3', got '$2')"; fi; }

WORK="$(mktemp -d)"
PGPORT=55444
APIPORT=45444
BASE="http://127.0.0.1:$APIPORT"
TOKEN="labs-e2e-token"
ADMIN="labs-e2e-admin"
PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"

cleanup() {
  [ -n "${API_PID:-}" ] && kill "$API_PID" >/dev/null 2>&1
  asPg "$PGBIN/pg_ctl" -D "$WORK/pg" stop -m immediate >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT

asPg() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u pguser -- "$@"
  else
    "$@"
  fi
}
if [ "$(id -u)" = "0" ]; then
  id pguser >/dev/null 2>&1 || useradd -m pguser
  chown -R pguser "$WORK"
fi

asPg "$PGBIN/initdb" -D "$WORK/pg" -U docrai --auth=trust >/dev/null 2>&1 || { echo "initdb failed"; exit 1; }
asPg "$PGBIN/pg_ctl" -D "$WORK/pg" -o "-p $PGPORT -k $WORK -h 127.0.0.1" -l "$WORK/pg.log" start >/dev/null || { echo "pg start failed"; cat "$WORK/pg.log"; exit 1; }
asPg "$PGBIN/createdb" -h 127.0.0.1 -p "$PGPORT" -U docrai docrai_labs >/dev/null 2>&1

DATABASE_URL="postgres://docrai@127.0.0.1:$PGPORT/docrai_labs" \
TESTER_TOKEN="$TOKEN" \
ADMIN_SECRET="$ADMIN" \
PORT="$APIPORT" \
MEDIA_DIR="$WORK/media" \
STATIC_DIR="$WORK/no-static" \
node src/index.js >"$WORK/api.log" 2>&1 &
API_PID=$!

for _ in $(seq 1 40); do curl -sf "$BASE/health" >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf "$BASE/health" >/dev/null || { echo "API never became healthy"; cat "$WORK/api.log"; exit 1; }

psql_q() { asPg "$PGBIN/psql" -h 127.0.0.1 -p "$PGPORT" -U docrai -d docrai_labs -tAc "$1" 2>/dev/null; }

# ── Schema ───────────────────────────────────────────────────────────────────
# Boot runs initDb(); retry briefly so the assertion does not race it.
for _ in $(seq 1 20); do
  [ "$(psql_q "SELECT to_regclass('public.ai_test_runs') IS NOT NULL")" = "t" ] && break
  sleep 0.5
done
check "ai_test_runs table created" "$(psql_q "SELECT to_regclass('public.ai_test_runs') IS NOT NULL")" "t"
check "benchmark_cases table created" "$(psql_q "SELECT to_regclass('public.benchmark_cases') IS NOT NULL")" "t"

# The run ledger must stay distinct from the report ledger: a Labs run is an
# experiment, and must never be counted as a generated report.
check "ai_test_runs is not report_generations" \
  "$(psql_q "SELECT count(*) FROM information_schema.columns WHERE table_name='ai_test_runs' AND column_name='doc_id'")" "0"

# ── Fixture loading ──────────────────────────────────────────────────────────
for _ in $(seq 1 20); do
  [ "$(psql_q "SELECT count(*) FROM benchmark_cases")" != "0" ] && break
  sleep 0.5
done
check "fixture seeded midtgjerdinga" "$(psql_q "SELECT count(*) FROM benchmark_cases WHERE case_id='midtgjerdinga'")" "1"
check "seeded case is flagged provisional" "$(psql_q "SELECT provisional FROM benchmark_cases WHERE case_id='midtgjerdinga'")" "t"
check "fasit carries the excluded cause" \
  "$(psql_q "SELECT reference->'excluded_causes'->0->>'category' FROM benchmark_cases WHERE case_id='midtgjerdinga'")" \
  "TRYKKSATT_RØR"

# ── Admin guard on every Labs route ──────────────────────────────────────────
for path in "labs/cases" "labs/runs" "labs/blocks"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/admin/$path")
  check "GET $path without secret is 401" "$code" "401"
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "x-admin-secret: wrong" "$BASE/api/admin/$path")
  check "GET $path with wrong secret is 401" "$code" "401"
done

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/labs/runs" \
  -H 'Content-Type: application/json' -d '{"projectId":"x"}')
check "POST runs without secret is 401" "$code" "401"

# ── Reads with a valid secret ────────────────────────────────────────────────
CASES=$(curl -s -H "x-admin-secret: $ADMIN" "$BASE/api/admin/labs/cases")
check "cases lists the seeded fasit" "$(echo "$CASES" | jq -r '.cases[0].caseId')" "midtgjerdinga"
check "cases marks it provisional" "$(echo "$CASES" | jq -r '.cases[0].provisional')" "true"
check "cases never leaks tester_token" "$(echo "$CASES" | grep -c 'tester_token')" "0"

RUNS=$(curl -s -H "x-admin-secret: $ADMIN" "$BASE/api/admin/labs/runs")
check "runs starts empty" "$(echo "$RUNS" | jq -r '.runs | length')" "0"

check "unknown run is 404" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "x-admin-secret: $ADMIN" "$BASE/api/admin/labs/runs/999999")" "404"

# ── Validation and failure handling ──────────────────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/labs/runs" \
  -H "x-admin-secret: $ADMIN" -H 'Content-Type: application/json' -d '{}')
check "POST runs without projectId is 400" "$code" "400"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/admin/labs/runs" \
  -H "x-admin-secret: $ADMIN" -H 'Content-Type: application/json' \
  -d '{"projectId":"p1","blocks":"not-an-array"}')
check "POST runs with non-array blocks is 400" "$code" "400"

# AI_ENGINE_URL is unset here. The config guard runs before the project lookup
# on purpose — a missing engine is a deployment fault, and reporting it as
# "project not found" would send you looking in the wrong place.
RESP=$(curl -s -X POST "$BASE/api/admin/labs/runs" \
  -H "x-admin-secret: $ADMIN" -H 'Content-Type: application/json' \
  -d '{"projectId":"missing-project"}')
check "run without an engine reports the config fault" "$(echo "$RESP" | jq -r '.code')" "AI_ENGINE_NOT_CONFIGURED"
# The run ledger is written only after the engine responds, so a request that
# never reached the engine must leave no trace to mistake for an experiment.
check "failed run wrote no ledger row" "$(psql_q "SELECT count(*) FROM ai_test_runs")" "0"

# ── Blocks proxy degrades honestly without an engine ─────────────────────────
check "blocks reports 503 when no engine is configured" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "x-admin-secret: $ADMIN" "$BASE/api/admin/labs/blocks")" "503"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "LABS E2E: all $PASS checks passed"
else
  echo "LABS E2E: $FAIL of $((PASS+FAIL)) checks FAILED"
  echo "--- api.log ---"; tail -40 "$WORK/api.log"
  exit 1
fi
