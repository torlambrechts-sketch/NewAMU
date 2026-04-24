# SQL migrations

**New migrations** — add timestamped `*.sql` files **in this directory** (`supabase/migrations/`), not under `archive/`, so the folder stays easy to scan.

**Historical migrations** — older SQL lives under **`archive/`**. `scripts/apply-migrations.sh` still discovers **all** `*.sql` files under `supabase/migrations/` recursively and runs them sorted by **basename** (timestamp prefix), so load order is unchanged.

They are **not** “run once then forgotten”: new environments still apply the full chain in filename order (`YYYYMMDDHHMMSS_...`).

**`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh` / `npm run db:migrate`) — Runs every `*.sql` file with `psql`, sorted by migration filename.

**Adding a new migration:** create `supabase/migrations/YYYYMMDDHHMMSS_my_change.sql` with a timestamp **after** the latest existing migration anywhere under this tree.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
