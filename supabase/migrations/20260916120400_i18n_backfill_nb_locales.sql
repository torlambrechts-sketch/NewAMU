-- i18n foundation (5/6) — backfill Norwegian (nb) sidecar rows.
--
-- Copies each existing vendor/system row's translatable columns into its
-- `<table>_locales` row at locale = 'nb'. This makes nb the guaranteed
-- fallback row before any English seed lands (migrations 6-8), so the locale
-- resolver always has a row to fall back to. Idempotent via on-conflict.
--
-- Per-org / customer-authored rows are intentionally excluded — they stay
-- single-language as authored (product decision). Filters use is_system where
-- the parent table mixes system and org rows.
--
-- Self-audit (Arbeidstilsynet POV): data-only migration, no content change —
-- the nb sidecar rows are byte-identical to the current parent columns.

insert into public.survey_template_catalog_locales
  (template_id, locale, name, short_name, description, use_case, scoring_note, body)
select id, default_locale, name, short_name, coalesce(description, ''), use_case, scoring_note, body
from public.survey_template_catalog
where is_system = true
on conflict (template_id, locale) do nothing;

insert into public.survey_template_categories_locales
  (category_id, locale, name, description)
select id, default_locale, name, description
from public.survey_template_categories
where is_system = true
on conflict (category_id, locale) do nothing;

insert into public.document_system_templates_locales
  (template_id, locale, label, description, page_payload)
select id, default_locale, label, description, page_payload
from public.document_system_templates
on conflict (template_id, locale) do nothing;

insert into public.wiki_legal_coverage_items_locales
  (item_id, locale, label)
select id, default_locale, label
from public.wiki_legal_coverage_items
on conflict (item_id, locale) do nothing;

insert into public.register_types_locales
  (register_type_id, locale, name, description, metadata_schema)
select id, default_locale, name, description, metadata_schema
from public.register_types
where is_system = true
on conflict (register_type_id, locale) do nothing;

insert into public.alert_system_templates_locales
  (template_id, locale, label, description, definition, metadata_schema)
select id, default_locale, label, description, definition, metadata_schema
from public.alert_system_templates
on conflict (template_id, locale) do nothing;

insert into public.meeting_system_templates_locales
  (template_id, locale, label, description, definition, metadata_schema)
select id, default_locale, label, description, definition, metadata_schema
from public.meeting_system_templates
on conflict (template_id, locale) do nothing;

insert into public.task_template_catalog_locales
  (template_id, locale, name, description, definition)
select id, default_locale, name, description, definition
from public.task_template_catalog
where is_system = true
on conflict (template_id, locale) do nothing;
