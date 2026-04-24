# SQL migrations

All timestamped migration `.sql` files live **directly in this directory** (`supabase/migrations/`). They are **not** “run once then forgotten”: new environments still apply the full chain in **filename order** (leading `YYYYMMDDHHMMSS_` timestamp). Subfolders are allowed if needed; `scripts/apply-migrations.sh` discovers all `*.sql` files recursively and sorts by **basename** only.

**`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh` / `npm run db:migrate`) — Runs every `*.sql` file under `supabase/migrations/` with `psql`, sorted by migration filename.

**Adding a new migration:** create a file here with a timestamp **after** the latest existing one, e.g. `20260709120000_my_change.sql`.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
