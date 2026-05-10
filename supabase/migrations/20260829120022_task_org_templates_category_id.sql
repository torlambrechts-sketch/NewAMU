-- Add category_id to task_org_templates — missed by _120015 on initial apply.
--
-- Coverage gap closed:
--   _120015 created task_template_categories and was supposed to add
--   category_id FK to task_org_templates, but the column was not present
--   in the deployed database. This migration adds it idempotently.

set local search_path = public, pg_catalog;

alter table public.task_org_templates
  add column if not exists category_id uuid
    references public.task_template_categories (id) on delete set null;

create index if not exists task_org_templates_category_idx
  on public.task_org_templates (category_id)
  where category_id is not null and deleted_at is null;
