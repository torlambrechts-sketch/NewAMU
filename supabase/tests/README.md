# pgTAP test suite

Database-level invariant tests, run against a fresh Supabase Postgres
via `supabase test db` (or `bash supabase/tests/run.sh` against a
running local stack). Companion to the Deno edge-function tests in
`supabase/functions/_shared/__tests__/` — those cover pure helpers,
this folder covers RLS predicates, security-definer functions, and
check constraints that the application code relies on.

## Conventions

- One `.sql` file per invariant.
- Filename prefix is the two-digit ordinal (`01_…`, `02_…`) so the
  runner executes them in a stable order; the suffix names the
  migration or behaviour under test (e.g. `01_evidence_org_mismatch.sql`
  covers `_20260907120700_workflow_evidence_org_validation.sql`).
- Each file: `BEGIN; SELECT plan(N); … assertions … ; SELECT * FROM finish(); ROLLBACK;`
  so the test DB stays clean between runs.
- Shared fixtures live in `conftest.sql`. The runner loads it once
  before iterating the numbered files; helpers are idempotent so
  re-running against a stateful DB is safe.

## Running locally

    supabase start                  # boots Postgres on :54322
    bash supabase/tests/run.sh

CI runs the same script via `.github/workflows/db-tests.yml`.
