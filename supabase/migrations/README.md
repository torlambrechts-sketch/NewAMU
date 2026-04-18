# SQL migrations

- **`archive/`** — Older timestamped migration `.sql` files. They are **not** “run once then forgotten”: new environments still apply the full chain in filename order.
- **Root (`supabase/migrations/*.sql`)** — Some newer migrations (for example SJA) live next to this README instead of under `archive/`. `scripts/apply-migrations.sh` discovers **all** `*.sql` files under `supabase/migrations/` recursively and sorts by **migration filename** (the leading `YYYYMMDDHHMMSS_` timestamp).
- **`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh`) — Runs the sorted files with `psql`.

**Adding a new migration:** create a file with a timestamp **after** the latest existing one, either under **`archive/`** or in this directory, e.g. `20260709120000_my_change.sql`.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
