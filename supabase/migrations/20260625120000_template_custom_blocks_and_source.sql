-- Per-org overrides for system template default blocks; track which system template a wiki page was created from

alter table public.document_org_template_settings
  add column if not exists custom_blocks jsonb;

comment on column public.document_org_template_settings.custom_blocks is
  'Optional org-specific override for default blocks when creating a page from this system template.';

alter table public.wiki_pages
  add column if not exists template_source_id text references public.document_system_templates (id) on delete set null;

create index if not exists wiki_pages_template_source_org_idx
  on public.wiki_pages (organization_id, template_source_id)
  where template_source_id is not null;

comment on column public.wiki_pages.template_source_id is 'System template id when page was created from catalog (for usage counts).';
