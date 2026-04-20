# SQL migrations

All timestamped migration `.sql` files live under **`archive/`**. They are **not** “run once then forgotten”: new environments still apply the full chain in filename order (leading `YYYYMMDDHHMMSS_` timestamp).

**`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh`) — Discovers **all** `*.sql` files under `supabase/migrations/` recursively and runs them with `psql` sorted by **migration filename**.

**Adding a new migration:** create a file with a timestamp **after** the latest existing one under **`archive/`**, e.g. `archive/20260709120000_my_change.sql`.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
