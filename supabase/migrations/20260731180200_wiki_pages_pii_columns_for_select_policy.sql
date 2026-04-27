-- Repair: wiki_pages_select_org references contains_pii / pii_categories; some DBs
-- never ran 20260630120000_wiki_pages_pii_gdpr_templates.sql. Safe to run multiple times.

alter table public.wiki_pages
  add column if not exists contains_pii boolean not null default false,
  add column if not exists pii_categories text[] not null default '{}',
  add column if not exists pii_legal_basis text,
  add column if not exists pii_retention_note text;
