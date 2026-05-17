#!/usr/bin/env bash
# pgTAP runner. Assumes a running Supabase local stack (`supabase start`)
# or any reachable Postgres with the migrations applied + pgtap installed.
# Usage: bash supabase/tests/run.sh
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:54322/postgres}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[pgtap] DB: ${DB_URL%@*}@…"
echo "[pgtap] loading conftest.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$DIR/conftest.sql" >/dev/null

PASS=0
FAIL=0
FAILED=()
for f in "$DIR"/0[0-9]_*.sql; do
  name="$(basename "$f")"
  echo "[pgtap] running $name"
  if psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    FAILED+=("$name")
  fi
done

echo "[pgtap] summary: passed=$PASS failed=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '[pgtap] failed: %s\n' "${FAILED[@]}"
  exit 1
fi
