-- Surveys — org context (location / department / team / participants) +
-- extensible per-template metadata jsonb.
--
-- Mirrors compliance_checklist_executions migration 20260828120024.
-- Surveys differ from checklists in one important way: the surveys row
-- itself is intentionally NOT locked at publish — only org_survey_questions
-- gets a lock via published_definition_locked. So T5 needs no trigger
-- relaxation; the new columns are amendable at any time by design.
-- Rename / summary edits already work on closed surveys, so the metadata
-- cluster joins them naturally.
--
-- Why a dedicated `metadata jsonb` instead of cramming everything into
-- existing nullable columns: a survey of "vendor egenerklæring" might
-- want a vendor-specific "evaluation_period" string; an "onboarding"
-- pulse might want a "start_date" date. Per-template metadata schema
-- (added in T6 to survey_org_templates) drives which fields surface.

set local search_path = public, pg_catalog;

alter table public.surveys
  add column if not exists location_id uuid
    references public.locations (id) on delete set null,
  add column if not exists department_id uuid
    references public.departments (id) on delete set null,
  add column if not exists team_id uuid
    references public.teams (id) on delete set null,
  add column if not exists participant_member_ids uuid[] not null
    default '{}'::uuid[],
  add column if not exists metadata jsonb not null
    default '{}'::jsonb;

create index if not exists surveys_location_idx
  on public.surveys (location_id)
  where location_id is not null;

create index if not exists surveys_department_idx
  on public.surveys (department_id)
  where department_id is not null;

create index if not exists surveys_team_idx
  on public.surveys (team_id)
  where team_id is not null;

create index if not exists surveys_participants_idx
  on public.surveys
  using gin (participant_member_ids);
