-- Repair: `end_date`, `start_date`, `vendor_*`, `survey_type` on public.surveys.
-- If PostgREST returns "Could not find the 'end_date' column ... in the schema cache",
-- the table was never altered (migration not applied) or the API cache is stale.
-- This file repeats the same ADD COLUMN IF NOT EXISTS as 20260801110000 (safe no-op when present).

alter table public.surveys
  add column if not exists survey_type text not null default 'internal'
    check (survey_type in ('internal', 'external', 'pulse', 'exit', 'onboarding')),
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists vendor_name text,
  add column if not exists vendor_org_number text;

create index if not exists surveys_org_type_idx
  on public.surveys (organization_id, survey_type);

notify pgrst, 'reload schema';
