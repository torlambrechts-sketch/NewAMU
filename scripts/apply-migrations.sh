#!/usr/bin/env bash
# Apply all SQL files under supabase/migrations/ (recursive, including archive/)
# in lexical order by filename (timestamp prefix YYYYMMDDHHMMSS_...).
# Convention: new migrations live in supabase/migrations/; older chain stays in archive/.
# Requires: psql (postgresql-client) and a Postgres connection URL in the environment.
#
# Reads the first non-empty value among:
#   DATABASE_URL, POSTGRES_URL_NON_POOLING, DIRECT_URL, POSTGRES_URL
#
# Usage:
#   export POSTGRES_URL_NON_POOLING='postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres'
#   npm run db:migrate
#
# Never commit connection strings or passwords to git.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="$ROOT/supabase/migrations"

URL="${DATABASE_URL:-${POSTGRES_URL_NON_POOLING:-${DIRECT_URL:-${POSTGRES_URL:-}}}}"
if [[ -z "${URL}" ]]; then
  echo "Mangler tilkoblingsstreng. Sett én av:" >&2
  echo "  DATABASE_URL, POSTGRES_URL_NON_POOLING, DIRECT_URL eller POSTGRES_URL" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql ble ikke funnet. Installer f.eks.: sudo apt install postgresql-client  (eller brew install libpq)" >&2
  exit 1
fi

FILES=()
while IFS= read -r line; do
  [[ -n "${line}" ]] && FILES+=("${line}")
done < <(
  # Sort by migration filename (timestamp prefix), not path — works with subfolders if any.
  find "${MIG_DIR}" -name '*.sql' -type f | awk -F/ '{ print $NF "\t" $0 }' | LC_ALL=C sort | cut -f2-
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Ingen .sql-filer i ${MIG_DIR}" >&2
  exit 1
fi

echo "Kjører ${#FILES[@]} migrasjon(er) mot database (sortert etter filnavn)…"

for f in "${FILES[@]}"; do
  echo "→ $(basename "${f}")"
  psql "${URL}" -v ON_ERROR_STOP=on -f "${f}"
done

echo "Ferdig."
