-- surveys.catalog_id — link a survey instance back to the catalog template it
-- was spawned from. Drives per-template reframing on /survey?template={id}
-- and per-template reporting downstream.
--
-- Nullable on purpose: pre-existing surveys won't have a catalog, and a
-- "blank" survey created without applying a template should remain valid.

set local search_path = public, pg_catalog;

alter table public.surveys
  add column if not exists catalog_id text
    references public.survey_template_catalog (id) on delete set null;

create index if not exists surveys_org_catalog_idx
  on public.surveys (organization_id, catalog_id)
  where catalog_id is not null;
