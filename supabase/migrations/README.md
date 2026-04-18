# SQL migrations

- **`archive/`** — All timestamped migration `.sql` files live here. They are **not** “run once then forgotten”: new environments still apply the full chain in filename order.
- **`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh`) — Discovers every `*.sql` file under `supabase/migrations/` (recursively), sorts by **migration filename** (the leading `YYYYMMDDHHMMSS_` timestamp), and runs them with `psql`.

**Adding a new migration:** create a new file under `archive/` (or optionally at the repo root of `migrations/` if you prefer it visible) with a timestamp **after** the latest existing one, e.g. `archive/20260709120000_my_change.sql`.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
