-- Repair: org_survey_questions / survey_question_bank columns & checks expected by the app.
-- PostgREST: "Could not find the 'is_mandatory' column ... in the schema cache"
-- means 20260801100000_survey_additions.sql was never applied (or cache stale).
-- Idempotent ADD COLUMN + constraint refresh + reload.

-- ── org_survey_questions ───────────────────────────────────────────────────────
alter table public.org_survey_questions
  add column if not exists is_mandatory boolean not null default false,
  add column if not exists mandatory_law text,
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Normalize mandatory_law check (drop/recreate so ADD COLUMN never fails on old partial state)
alter table public.org_survey_questions
  drop constraint if exists org_survey_questions_mandatory_law_check;

alter table public.org_survey_questions
  add constraint org_survey_questions_mandatory_law_check
  check (mandatory_law is null or mandatory_law in ('AML_4_3', 'AML_4_4', 'AML_6_2'));

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

-- ── survey_question_bank (same shape as questions) ───────────────────────────
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

notify pgrst, 'reload schema';
