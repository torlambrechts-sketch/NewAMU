-- i18n foundation (4/6) — per-locale sidecar tables for vendor-seeded content.
--
-- Eight vendor/system content tables store a single Norwegian string per
-- column with no locale dimension. This migration mirrors the proven
-- learning_system_course_locales pattern for each of them: a `<table>_locales`
-- sidecar with composite PK (<parent_id>, locale) holding the translatable
-- text/jsonb, plus a `default_locale` column on each parent marking the source
-- language. The original parent columns are kept (forward-only) as the nb
-- mirror; the app reads through the sidecar with a coalesce fallback.
--
-- Pure-additive: no parent column is dropped or altered. Backfill of the nb
-- rows happens in migration 5 (20260916120400); English seed in migrations 6-8.
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn.
-- The compliance-content tables (survey/document/register/alert/meeting/task
-- system templates) gain a translation surface but no content changes here.

-- ── default_locale on each parent ───────────────────────────────────────────
alter table public.survey_template_catalog
  add column if not exists default_locale text not null default 'nb';
alter table public.survey_template_categories
  add column if not exists default_locale text not null default 'nb';
alter table public.document_system_templates
  add column if not exists default_locale text not null default 'nb';
alter table public.wiki_legal_coverage_items
  add column if not exists default_locale text not null default 'nb';
alter table public.register_types
  add column if not exists default_locale text not null default 'nb';
alter table public.alert_system_templates
  add column if not exists default_locale text not null default 'nb';
alter table public.meeting_system_templates
  add column if not exists default_locale text not null default 'nb';
alter table public.task_template_catalog
  add column if not exists default_locale text not null default 'nb';

do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array[
    'survey_template_catalog','survey_template_categories','document_system_templates',
    'wiki_legal_coverage_items','register_types','alert_system_templates',
    'meeting_system_templates','task_template_catalog'
  ] loop
    if not exists (
      select 1 from pg_constraint
      where conname = v_tbl || '_default_locale_fk'
        and conrelid = ('public.' || v_tbl)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (default_locale) references public.app_locales (code)',
        v_tbl, v_tbl || '_default_locale_fk');
    end if;
  end loop;
end $$;

comment on column public.survey_template_catalog.default_locale is
  'Source language of the parent-row text columns; last fallback link before nb.';

-- ── survey_template_catalog_locales ─────────────────────────────────────────
create table if not exists public.survey_template_catalog_locales (
  template_id  text not null references public.survey_template_catalog (id) on delete cascade,
  locale       text not null references public.app_locales (code),
  name         text not null,
  short_name   text,
  description  text not null default '',
  use_case     text,
  scoring_note text,
  body         jsonb not null default '{}'::jsonb,
  primary key (template_id, locale)
);
comment on column public.survey_template_catalog_locales.body is
  'Whole-document translated survey body for this locale. Same shape as survey_template_catalog.body.';

-- ── survey_template_categories_locales ──────────────────────────────────────
create table if not exists public.survey_template_categories_locales (
  category_id uuid not null references public.survey_template_categories (id) on delete cascade,
  locale      text not null references public.app_locales (code),
  name        text not null,
  description text,
  primary key (category_id, locale)
);

-- ── document_system_templates_locales ───────────────────────────────────────
create table if not exists public.document_system_templates_locales (
  template_id  text not null references public.document_system_templates (id) on delete cascade,
  locale       text not null references public.app_locales (code),
  label        text not null,
  description  text not null default '',
  page_payload jsonb not null default '{}'::jsonb,
  primary key (template_id, locale)
);
comment on column public.document_system_templates_locales.page_payload is
  'Whole-document translated page_payload for this locale. Law-ref blocks keep their legal citations untranslated.';

-- ── wiki_legal_coverage_items_locales ───────────────────────────────────────
create table if not exists public.wiki_legal_coverage_items_locales (
  item_id uuid not null references public.wiki_legal_coverage_items (id) on delete cascade,
  locale  text not null references public.app_locales (code),
  label   text not null,
  primary key (item_id, locale)
);

-- ── register_types_locales ──────────────────────────────────────────────────
create table if not exists public.register_types_locales (
  register_type_id text not null references public.register_types (id) on delete cascade,
  locale           text not null references public.app_locales (code),
  name             text not null,
  description      text,
  metadata_schema  jsonb not null default '{"fields":[]}'::jsonb,
  primary key (register_type_id, locale)
);
comment on column public.register_types_locales.metadata_schema is
  'Whole-schema translated metadata_schema for this locale (field labels translated; field ids/kinds untouched).';

-- ── alert_system_templates_locales ──────────────────────────────────────────
create table if not exists public.alert_system_templates_locales (
  template_id     text not null references public.alert_system_templates (id) on delete cascade,
  locale          text not null references public.app_locales (code),
  label           text not null,
  description     text,
  definition      jsonb not null default '{}'::jsonb,
  metadata_schema jsonb not null default '{"fields":[]}'::jsonb,
  primary key (template_id, locale)
);
comment on column public.alert_system_templates_locales.definition is
  'Whole-document translated alert definition (preparationGuidance, form labels, checklist labels) for this locale.';

-- ── meeting_system_templates_locales ────────────────────────────────────────
create table if not exists public.meeting_system_templates_locales (
  template_id     text not null references public.meeting_system_templates (id) on delete cascade,
  locale          text not null references public.app_locales (code),
  label           text not null,
  description     text,
  definition      jsonb not null default '{}'::jsonb,
  metadata_schema jsonb not null default '{"fields":[]}'::jsonb,
  primary key (template_id, locale)
);
comment on column public.meeting_system_templates_locales.definition is
  'Whole-document translated meeting definition (agenda titles/descriptions, checklist labels) for this locale.';

-- ── task_template_catalog_locales ───────────────────────────────────────────
create table if not exists public.task_template_catalog_locales (
  template_id uuid not null references public.task_template_catalog (id) on delete cascade,
  locale      text not null references public.app_locales (code),
  name        text not null,
  description text not null default '',
  definition  jsonb not null default '{"fields":[],"checklist_items":[]}'::jsonb,
  primary key (template_id, locale)
);
comment on column public.task_template_catalog_locales.definition is
  'Whole-document translated task definition (field labels, checklist_items text) for this locale.';

-- ── RLS — system content is global-readable; writes via admin RPC / service role
do $$
declare
  v_tbl text;
begin
  foreach v_tbl in array array[
    'survey_template_catalog_locales','survey_template_categories_locales',
    'document_system_templates_locales','wiki_legal_coverage_items_locales',
    'register_types_locales','alert_system_templates_locales',
    'meeting_system_templates_locales','task_template_catalog_locales'
  ] loop
    execute format('alter table public.%I enable row level security', v_tbl);
    execute format('drop policy if exists %I on public.%I', v_tbl || '_select_authenticated', v_tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      v_tbl || '_select_authenticated', v_tbl);
  end loop;
end $$;
