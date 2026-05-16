-- Add soft-delete column to document_org_templates so /admin/templates
-- can fan out the «Slett» action to documents. Existing code reads via
-- `useAdminTemplates` which already filters `deleted_at is null` (see
-- src/hooks/useAdminTemplates.ts:126 for documents). Adding the column
-- makes the existing filter actually function instead of erroring out.
--
-- Per-page wiki content uses `wiki_pages.deleted_at` (already exists);
-- this column is specifically for the *template* row, not the
-- instances created from it.

alter table public.document_org_templates
  add column if not exists deleted_at timestamptz null;

create index if not exists document_org_templates_active_idx
  on public.document_org_templates (organization_id)
  where deleted_at is null;

comment on column public.document_org_templates.deleted_at is
  'Soft-delete marker. NULL = active row. Set via /admin/templates → slett.';
