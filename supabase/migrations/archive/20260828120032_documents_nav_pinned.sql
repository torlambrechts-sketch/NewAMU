-- Pin per-org document templates to the sidebar (documents-parity §T5).
--
-- Mirrors the survey + checklist `nav_pinned` pattern: a boolean column
-- on the per-org override row drives which templates surface in the
-- sidebar's "Dokumenter" group below the fixed Analyse / Innstillinger
-- entries. Defaults to false so existing rows stay invisible until an
-- admin opts in (the recovery bundle migration in T7 will force-pin
-- pristine rows so day-one tenants don't see an empty sidebar).
--
-- Idempotent: `add column if not exists`.

set local search_path = public, pg_catalog;

alter table public.document_org_templates
  add column if not exists nav_pinned boolean not null default false;

-- Partial index for the sidebar query (`useDocumentNav`).
create index if not exists document_org_templates_pinned_idx
  on public.document_org_templates (organization_id)
  where nav_pinned = true;
