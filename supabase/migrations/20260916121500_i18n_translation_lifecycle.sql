-- i18n — translation lifecycle metadata + drift detection.
--
-- The _locales sidecar tables stored translations but had no way to tell a
-- real translation from a Norwegian placeholder, nor to detect when a
-- translation went stale because its nb source changed afterwards. Silent
-- drift is the main failure mode of database-driven i18n — this migration
-- closes it.
--
-- Per _locales table:
--   content_hash       sha256 of THIS row's own translatable content,
--                      maintained by a BEFORE trigger (always current).
--   source_hash        the nb sibling's content_hash captured when this
--                      translation was made — null for nb / placeholder rows.
--   translation_status placeholder | machine | reviewed | approved.
--   translated_at      when the translation was last written.
--   translated_by      profiles.id of the reviewer (set by the review RPC).
--
-- A translation is STALE when source_hash <> the nb sibling's current
-- content_hash. The i18n_translation_status view exposes that cheaply (a
-- column compare — no re-hashing at query time).
--
-- Nothing gates on translation_status yet — it is metadata for the upcoming
-- machine-translation + review pipeline. No behaviour change in this migration.
--
-- Self-audit (Arbeidstilsynet POV): infrastructure migration, no pålegg-grunn,
-- no compliance content changed.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Lifecycle columns on every _locales sidecar table ────────────────────
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
    execute format('alter table public.%I add column if not exists content_hash text', v_tbl);
    execute format('alter table public.%I add column if not exists source_hash text', v_tbl);
    execute format(
      $fmt$alter table public.%I add column if not exists translation_status text not null default 'placeholder'$fmt$,
      v_tbl);
    execute format('alter table public.%I add column if not exists translated_at timestamptz', v_tbl);
    execute format('alter table public.%I add column if not exists translated_by uuid', v_tbl);
    execute format('alter table public.%I drop constraint if exists %I', v_tbl, v_tbl || '_status_check');
    execute format(
      $fmt$alter table public.%I add constraint %I check (translation_status in ('placeholder','machine','reviewed','approved'))$fmt$,
      v_tbl, v_tbl || '_status_check');
  end loop;
end $$;

comment on column public.survey_template_catalog_locales.content_hash is
  'sha256 of this row''s own translatable content; maintained by the i18n_set_content_hash trigger.';
comment on column public.survey_template_catalog_locales.source_hash is
  'The nb sibling content_hash captured when this translation was made. Stale when it no longer matches the nb row.';
comment on column public.survey_template_catalog_locales.translation_status is
  'placeholder (nb copy) | machine (translated, unreviewed) | reviewed | approved.';

-- ── 2. Content-hash trigger — generic across all eight tables ───────────────
-- Hashes every column except the five lifecycle columns. parent_id and locale
-- are constant per row, so including them does not affect drift detection.
create or replace function public.i18n_set_content_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.content_hash := encode(
    sha256(convert_to(
      (to_jsonb(new)
        - 'content_hash' - 'source_hash' - 'translation_status'
        - 'translated_at' - 'translated_by'
      )::text, 'UTF8')),
    'hex');
  return new;
end;
$$;

comment on function public.i18n_set_content_hash() is
  'BEFORE INSERT/UPDATE trigger for the *_locales tables — keeps content_hash current for translation drift detection.';

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
    execute format('drop trigger if exists trg_i18n_content_hash on public.%I', v_tbl);
    execute format(
      'create trigger trg_i18n_content_hash before insert or update on public.%I for each row execute function public.i18n_set_content_hash()',
      v_tbl);
  end loop;
end $$;

-- ── 3. Backfill content_hash on existing rows (a no-op UPDATE fires the trigger)
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
    execute format('update public.%I set content_hash = null', v_tbl);
  end loop;
end $$;

-- ── 4. Backfill translation_status + source_hash ────────────────────────────
-- nb rows are the canonical source → approved. en rows came from Phase 2:
-- display fields translated, jsonb bodies still nb placeholders → machine
-- (translated, pending domain review). source_hash := the nb content_hash so
-- the en rows start NOT stale relative to the current nb source.
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
    execute format($fmt$update public.%I set translation_status = 'approved' where locale = 'nb'$fmt$, v_tbl);
    execute format($fmt$update public.%I set translation_status = 'machine', translated_at = now() where locale <> 'nb'$fmt$, v_tbl);
  end loop;
end $$;

update public.survey_template_catalog_locales e set source_hash = n.content_hash
  from public.survey_template_catalog_locales n
  where n.template_id = e.template_id and n.locale = 'nb' and e.locale <> 'nb';
update public.survey_template_categories_locales e set source_hash = n.content_hash
  from public.survey_template_categories_locales n
  where n.category_id = e.category_id and n.locale = 'nb' and e.locale <> 'nb';
update public.document_system_templates_locales e set source_hash = n.content_hash
  from public.document_system_templates_locales n
  where n.template_id = e.template_id and n.locale = 'nb' and e.locale <> 'nb';
update public.wiki_legal_coverage_items_locales e set source_hash = n.content_hash
  from public.wiki_legal_coverage_items_locales n
  where n.item_id = e.item_id and n.locale = 'nb' and e.locale <> 'nb';
update public.register_types_locales e set source_hash = n.content_hash
  from public.register_types_locales n
  where n.register_type_id = e.register_type_id and n.locale = 'nb' and e.locale <> 'nb';
update public.alert_system_templates_locales e set source_hash = n.content_hash
  from public.alert_system_templates_locales n
  where n.template_id = e.template_id and n.locale = 'nb' and e.locale <> 'nb';
update public.meeting_system_templates_locales e set source_hash = n.content_hash
  from public.meeting_system_templates_locales n
  where n.template_id = e.template_id and n.locale = 'nb' and e.locale <> 'nb';
update public.task_template_catalog_locales e set source_hash = n.content_hash
  from public.task_template_catalog_locales n
  where n.template_id = e.template_id and n.locale = 'nb' and e.locale <> 'nb';

-- ── 5. Drift-visibility view ────────────────────────────────────────────────
-- One row per translated entity/locale; is_stale = the nb source moved since
-- this translation was made. security_invoker so it respects _locales RLS.
create or replace view public.i18n_translation_status
with (security_invoker = true) as
  select 'survey_template_catalog' as entity, l.template_id::text as entity_id,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash) as is_stale
  from public.survey_template_catalog_locales l
  left join public.survey_template_catalog_locales n
    on n.template_id = l.template_id and n.locale = 'nb'
  union all
  select 'survey_template_categories', l.category_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.survey_template_categories_locales l
  left join public.survey_template_categories_locales n
    on n.category_id = l.category_id and n.locale = 'nb'
  union all
  select 'document_system_templates', l.template_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.document_system_templates_locales l
  left join public.document_system_templates_locales n
    on n.template_id = l.template_id and n.locale = 'nb'
  union all
  select 'wiki_legal_coverage_items', l.item_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.wiki_legal_coverage_items_locales l
  left join public.wiki_legal_coverage_items_locales n
    on n.item_id = l.item_id and n.locale = 'nb'
  union all
  select 'register_types', l.register_type_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.register_types_locales l
  left join public.register_types_locales n
    on n.register_type_id = l.register_type_id and n.locale = 'nb'
  union all
  select 'alert_system_templates', l.template_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.alert_system_templates_locales l
  left join public.alert_system_templates_locales n
    on n.template_id = l.template_id and n.locale = 'nb'
  union all
  select 'meeting_system_templates', l.template_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.meeting_system_templates_locales l
  left join public.meeting_system_templates_locales n
    on n.template_id = l.template_id and n.locale = 'nb'
  union all
  select 'task_template_catalog', l.template_id::text,
         l.locale, l.translation_status, l.translated_at,
         (l.locale <> 'nb' and l.source_hash is distinct from n.content_hash)
  from public.task_template_catalog_locales l
  left join public.task_template_catalog_locales n
    on n.template_id = l.template_id and n.locale = 'nb';

comment on view public.i18n_translation_status is
  'Per entity/locale translation state across all *_locales tables. is_stale = the nb source changed after this translation was made.';

grant select on public.i18n_translation_status to authenticated;
