-- Survey builder sections (folder-like) + extended question_type enum.

-- ── 1) Sections ──────────────────────────────────────────────────────────────
create table if not exists public.survey_sections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  survey_id        uuid not null references public.surveys (id) on delete cascade,
  title            text not null default 'Seksjon',
  description      text,
  order_index      int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists survey_sections_survey_order_idx
  on public.survey_sections (survey_id, order_index);

alter table public.survey_sections enable row level security;

drop policy if exists survey_sections_select on public.survey_sections;
create policy survey_sections_select
  on public.survey_sections for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_sections_write on public.survey_sections;
create policy survey_sections_write
  on public.survey_sections for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

grant select, insert, update, delete on public.survey_sections to authenticated;

do $u$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    execute 'drop trigger if exists survey_sections_set_updated_at on public.survey_sections';
    execute $t$
      create trigger survey_sections_set_updated_at
      before update on public.survey_sections
      for each row execute function public.set_updated_at()
    $t$;
  end if;
end $u$;

-- ── 2) Questions → optional section ─────────────────────────────────────────
alter table public.org_survey_questions
  add column if not exists section_id uuid references public.survey_sections (id) on delete set null;

create index if not exists org_survey_questions_section_idx
  on public.org_survey_questions (survey_id, section_id, order_index);

-- ── 3) Extended question_type checks (org + bank) ───────────────────────────
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
    'multiple_choice',
    'short_text',
    'long_text',
    'email',
    'number',
    'rating_visual',
    'slider',
    'dropdown',
    'image_choice',
    'likert_scale',
    'matrix',
    'ranking',
    'nps',
    'file_upload',
    'datetime',
    'signature'
  ));

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
    'multiple_choice',
    'short_text',
    'long_text',
    'email',
    'number',
    'rating_visual',
    'slider',
    'dropdown',
    'image_choice',
    'likert_scale',
    'matrix',
    'ranking',
    'nps',
    'file_upload',
    'datetime',
    'signature'
  ));

select pg_notify('pgrst', 'reload schema');
