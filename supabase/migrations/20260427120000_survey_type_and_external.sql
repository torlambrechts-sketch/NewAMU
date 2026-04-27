-- Survey module: add survey_type, date range, and vendor fields.
-- Supports internal employee surveys, external vendor surveys, pulse checks,
-- exit interviews, and onboarding surveys (AML § 3-1, § 4-3, Åpenhetsloven § 4).

alter table public.surveys
  add column if not exists survey_type text not null default 'internal'
    check (survey_type in ('internal', 'external', 'pulse', 'exit', 'onboarding')),
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists vendor_name text,
  add column if not exists vendor_org_number text;

-- Index: fast lookup of external/vendor surveys per org
create index if not exists surveys_org_type_idx
  on public.surveys (organization_id, survey_type);
