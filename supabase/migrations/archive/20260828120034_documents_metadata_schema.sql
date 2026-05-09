-- Schema-driven page metadata for documents (documents-parity §T8).
--
-- Two additive jsonb columns:
--   - document_org_templates.metadata_schema — declares which fields a
--     page surfaces above the body when authored from this template.
--     Same shape as compliance/survey/learning template metadata schemas
--     (re-exported via src/types/documents.ts).
--
--   - wiki_pages.metadata — the per-page bag of values keyed by the
--     schema's field keys. Free-form jsonb; pages without a template
--     stay empty `{}`.
--
-- Both default to a valid JSON literal so callers don't need to coalesce.
-- Idempotent via `add column if not exists`; safe to re-apply.

set local search_path = public, pg_catalog;

alter table public.document_org_templates
  add column if not exists metadata_schema jsonb not null
    default '{"fields":[]}'::jsonb;

comment on column public.document_org_templates.metadata_schema is
  $c$Field declarations driving the schema-driven metadata panel above
  the page body when a wiki_page is authored from this template. Same
  shape as compliance_checklist_templates.metadata_schema.$c$;

alter table public.wiki_pages
  add column if not exists metadata jsonb not null
    default '{}'::jsonb;

comment on column public.wiki_pages.metadata is
  $c$Free-form per-page metadata bag keyed by the source template's
  metadata_schema. Empty `{}` for pages authored without a template.$c$;
