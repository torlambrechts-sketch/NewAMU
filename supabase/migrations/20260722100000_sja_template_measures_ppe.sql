-- ─────────────────────────────────────────────────────────────────────────────
-- SJA TEMPLATE ENHANCEMENTS
-- 1. required_ppe on templates (standard PPE baseline)
-- 2. is_mandatory + deletion_justification on live measures (informed deviation)
-- ─────────────────────────────────────────────────────────────────────────────

-- Add PPE baseline to templates
alter table public.sja_templates
  add column if not exists required_ppe text[] not null default '{}';

-- Add mandatory flag and justification to live measures
alter table public.sja_measures
  add column if not exists is_from_template boolean not null default false,
  add column if not exists is_mandatory      boolean not null default false,
  add column if not exists deletion_justification text;

-- Index for querying mandatory measures that were deleted (audit use)
-- We use a soft-delete pattern: deleted_at instead of hard delete
alter table public.sja_measures
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists sja_measures_mandatory_idx
  on public.sja_measures(sja_id, is_mandatory)
  where deleted_at is null;

-- Hide soft-deleted measures from normal reads (RLS)
drop policy if exists sja_measures_select on public.sja_measures;
create policy sja_measures_select on public.sja_measures for select to authenticated
  using (
    sja_measures.deleted_at is null
    and exists (
      select 1 from public.sja_analyses a
      where a.id = sja_measures.sja_id
        and a.organization_id = public.current_org_id()
        and a.deleted_at is null
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTES ON PREFILL_TASKS JSONB SCHEMA
-- The existing prefill_tasks column stores tasks as JSONB.
-- After this migration, the expected shape is:
--
-- prefill_tasks: [
--   {
--     "title": "Forberedelse",
--     "description": "...",
--     "position": 0,
--     "hazards": [
--       {
--         "description": "Brannfare",
--         "category": "fire",
--         "measures": [
--           {
--             "description": "Brannslukker tilstede",
--             "control_type": "administrative",
--             "is_mandatory": true        <-- NEW
--           }
--         ]
--       }
--     ]
--   }
-- ]
--
-- No schema migration needed for prefill_tasks itself — JSONB is flexible.
-- App code reads/writes the new shape; old records without measures still work.
-- ─────────────────────────────────────────────────────────────────────────────
