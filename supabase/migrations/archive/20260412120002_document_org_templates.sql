-- Org-specific custom page templates (created by documents.manage)

create table if not exists public.document_org_templates (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  description text not null default '',
  category text not null check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library')),
  legal_basis text[] not null default '{}',
  page_payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_org_templates_org_idx on public.document_org_templates (organization_id);

drop trigger if exists document_org_templates_set_updated_at on public.document_org_templates;
create trigger document_org_templates_set_updated_at
  before update on public.document_org_templates
  for each row execute function public.set_updated_at();

alter table public.document_org_templates enable row level security;

create policy "document_org_templates_select"
  on public.document_org_templates for select
  using (organization_id = public.current_org_id());

create policy "document_org_templates_insert"
  on public.document_org_templates for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "document_org_templates_update"
  on public.document_org_templates for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "document_org_templates_delete"
  on public.document_org_templates for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );
