# SQL migrations

**New migrations** — add timestamped `*.sql` files in **`supabase/migrations/`** (convention: at repo root of this folder, e.g. `20260801120000_my_change.sql`), **not** under **`archive/`**. **Do not add or update** SQL in `supabase/migrations/archive/`; that tree is the historical chain only. New work is always a new file with a timestamp after the latest migration in the tree.

**`archive/`** — legacy chain kept for reference and for `apply-migrations` compatibility on old clones. New environments should still apply; treat as read-only when developing.

They are **not** “run once then forgotten”: new environments still apply the full chain in filename order (`YYYYMMDDHHMMSS_...`).

**`../../scripts/apply-migrations.sh`** (from repo root: `scripts/apply-migrations.sh` / `npm run db:migrate`) — Runs every `*.sql` file with `psql`, sorted by migration filename.

**Adding a new migration:** create `supabase/migrations/YYYYMMDDHHMMSS_my_change.sql` with a timestamp **after** the latest existing migration anywhere under this tree.

Do **not** edit or remove files that may already have been applied in deployed databases; add a new forward migration instead.
