-- Survey template catalog (DB-driven) + extended org_survey_questions types
-- (1–10, ja/nei, enkeltvalg, flervalg med JSON i org_questions.config)

-- ── 1) survey_template_catalog ------------------------------------------------
create table if not exists public.survey_template_catalog (
  id                text primary key,
  organization_id   uuid references public.organizations (id) on delete cascade,
  is_system         boolean not null default false,
  name              text not null,
  short_name        text,
  description       text,
  source            text,
  use_case          text,
  category          text not null,
  audience          text not null default 'internal'
    check (audience in ('internal', 'external', 'both')),
  estimated_minutes int not null default 5,
  recommend_anonymous boolean not null default true,
  scoring_note      text,
  law_ref             text,
  body                jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists survey_template_catalog_org_idx
  on public.survey_template_catalog (organization_id, category, is_active)
  where organization_id is not null;

create index if not exists survey_template_catalog_system_idx
  on public.survey_template_catalog (is_system, is_active, category)
  where is_system = true;

alter table public.survey_template_catalog enable row level security;

drop policy if exists survey_template_catalog_select on public.survey_template_catalog;
create policy survey_template_catalog_select
  on public.survey_template_catalog for select to authenticated
  using (
    (is_system = true and is_active = true and organization_id is null)
    or (organization_id = public.current_org_id())
  );

drop policy if exists survey_template_catalog_insert on public.survey_template_catalog;
create policy survey_template_catalog_insert
  on public.survey_template_catalog for insert to authenticated
  with check (
    is_system = false
    and organization_id = public.current_org_id()
  );

drop policy if exists survey_template_catalog_update on public.survey_template_catalog;
create policy survey_template_catalog_update
  on public.survey_template_catalog for update to authenticated
  using (is_system = false and organization_id = public.current_org_id())
  with check (is_system = false and organization_id = public.current_org_id());

drop policy if exists survey_template_catalog_delete on public.survey_template_catalog;
create policy survey_template_catalog_delete
  on public.survey_template_catalog for delete to authenticated
  using (is_system = false and organization_id = public.current_org_id());

grant select, insert, update, delete on public.survey_template_catalog to authenticated;

-- Optional: anon can list system active (for public links) — not required; keep off

-- triggers: updated_at
drop trigger if exists survey_template_catalog_set_updated_at on public.survey_template_catalog;
create trigger survey_template_catalog_set_updated_at
  before update on public.survey_template_catalog
  for each row execute function public.set_updated_at();

-- ── 2) org_survey_questions: config + extended types --------------------------
alter table public.org_survey_questions
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.org_survey_questions
  drop constraint if exists org_survey_questions_question_type_check;

alter table public.org_survey_questions
  add constraint org_survey_questions_question_type_check
  check (question_type in (
    'rating_1_to_5',
    'rating_1_to_10',
    'text',
    'yes_no',
    'single_select',
    'multi_select',
    'multiple_choice'
  ));

-- Bank: same types (re-uses for org copy)
alter table public.survey_question_bank
  add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.survey_question_bank
  drop constraint if exists survey_question_bank_question_type_check;

alter table public.survey_question_bank
  add constraint survey_question_bank_question_type_check
  check (question_type in (
    'rating_1_to_5',
    'rating_1_to_10',
    'text',
    'yes_no',
    'single_select',
    'multi_select',
    'multiple_choice'
  ));
