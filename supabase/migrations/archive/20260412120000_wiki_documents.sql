-- Documents & Wiki: org-scoped spaces, pages, audit, receipts + global templates.

-- ---------------------------------------------------------------------------
-- Legal coverage reference (same for all orgs; replaces static LEGAL_COVERAGE)
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_legal_coverage_items (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  label text not null,
  template_ids text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- System page templates (global catalog; orgs enable per template)
-- ---------------------------------------------------------------------------

create table if not exists public.document_system_templates (
  id text primary key,
  slug text not null unique,
  label text not null,
  description text not null default '',
  category text not null check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library')),
  legal_basis text[] not null default '{}',
  page_payload jsonb not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.document_org_template_settings (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id text not null references public.document_system_templates (id) on delete cascade,
  enabled boolean not null default true,
  primary key (organization_id, template_id)
);

create index if not exists document_org_template_settings_org_idx
  on public.document_org_template_settings (organization_id);

-- ---------------------------------------------------------------------------
-- Wiki spaces & pages
-- ---------------------------------------------------------------------------

create table if not exists public.wiki_spaces (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null check (category in ('hms_handbook', 'policy', 'procedure', 'guide', 'template_library')),
  icon text not null default '📁',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wiki_spaces_org_idx on public.wiki_spaces (organization_id);

create table if not exists public.wiki_pages (
  id text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  space_id text not null references public.wiki_spaces (id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  template text not null default 'standard' check (template in ('standard', 'wide', 'policy')),
  legal_refs text[] not null default '{}',
  requires_acknowledgement boolean not null default false,
  blocks jsonb not null default '[]',
  version int not null default 1,
  author_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wiki_pages_org_idx on public.wiki_pages (organization_id);
create index if not exists wiki_pages_space_idx on public.wiki_pages (space_id);

create table if not exists public.wiki_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null,
  page_title text not null,
  action text not null check (action in ('created', 'updated', 'published', 'archived', 'acknowledged')),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_version int,
  to_version int not null,
  at timestamptz not null default now(),
  snapshot text
);

create index if not exists wiki_audit_org_idx on public.wiki_audit_ledger (organization_id);
create index if not exists wiki_audit_page_idx on public.wiki_audit_ledger (page_id);

create table if not exists public.wiki_compliance_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  page_id text not null,
  page_title text not null,
  page_version int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  user_name text not null,
  acknowledged_at timestamptz not null default now()
);

create index if not exists wiki_receipts_org_idx on public.wiki_compliance_receipts (organization_id);
create index if not exists wiki_receipts_page_idx on public.wiki_compliance_receipts (page_id, user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists wiki_spaces_set_updated_at on public.wiki_spaces;
create trigger wiki_spaces_set_updated_at
  before update on public.wiki_spaces
  for each row execute function public.set_updated_at();

drop trigger if exists wiki_pages_set_updated_at on public.wiki_pages;
create trigger wiki_pages_set_updated_at
  before update on public.wiki_pages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.wiki_legal_coverage_items enable row level security;
alter table public.document_system_templates enable row level security;
alter table public.document_org_template_settings enable row level security;
alter table public.wiki_spaces enable row level security;
alter table public.wiki_pages enable row level security;
alter table public.wiki_audit_ledger enable row level security;
alter table public.wiki_compliance_receipts enable row level security;

-- Legal coverage: readable by any authenticated org member
create policy "wiki_legal_coverage_select"
  on public.wiki_legal_coverage_items for select
  to authenticated
  using (true);

-- System templates: readable by all authenticated
create policy "document_system_templates_select"
  on public.document_system_templates for select
  to authenticated
  using (true);

-- Org template settings
create policy "document_org_template_select"
  on public.document_org_template_settings for select
  using (organization_id = public.current_org_id());

create policy "document_org_template_insert_manage"
  on public.document_org_template_settings for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "document_org_template_update_manage"
  on public.document_org_template_settings for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- System templates: only service role / migration writes — no user insert policy

-- Wiki spaces
create policy "wiki_spaces_select_org"
  on public.wiki_spaces for select
  using (organization_id = public.current_org_id());

create policy "wiki_spaces_insert_org"
  on public.wiki_spaces for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_spaces_update_org"
  on public.wiki_spaces for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- Wiki pages: all org members read
create policy "wiki_pages_select_org"
  on public.wiki_pages for select
  using (organization_id = public.current_org_id());

create policy "wiki_pages_insert_manage"
  on public.wiki_pages for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_pages_update_manage"
  on public.wiki_pages for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

create policy "wiki_pages_delete_manage"
  on public.wiki_pages for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('documents.manage'))
  );

-- Audit: read org; insert manage
create policy "wiki_audit_select_org"
  on public.wiki_audit_ledger for select
  using (organization_id = public.current_org_id());

create policy "wiki_audit_insert"
  on public.wiki_audit_ledger for insert
  with check (
    organization_id = public.current_org_id()
    and (
      (public.is_org_admin() or public.user_has_permission('documents.manage'))
      or (user_id = auth.uid() and action = 'acknowledged')
    )
  );

-- Receipts: users read own + manage sees all
create policy "wiki_receipts_select_org"
  on public.wiki_compliance_receipts for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  );

create policy "wiki_receipts_insert_own"
  on public.wiki_compliance_receipts for insert
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Permission key: documents.manage (grant to all org Admin roles)
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'documents.manage'
from public.role_definitions rd
where rd.slug = 'admin' and rd.is_system = true
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RPC: ensure default wiki data for org (seed spaces + template toggles)
-- ---------------------------------------------------------------------------

create or replace function public.wiki_ensure_org_defaults()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then return; end if;

  -- Default: all system templates enabled for org (no rows = all enabled in UI; insert explicit enables for clarity)
  insert into public.document_org_template_settings (organization_id, template_id, enabled)
  select v_org, t.id, true
  from public.document_system_templates t
  on conflict (organization_id, template_id) do nothing;

  -- Seed folders if none (matches former SEED_SPACES)
  if not exists (select 1 from public.wiki_spaces where organization_id = v_org) then
    insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status)
    values
      (gen_random_uuid()::text, v_org, 'HMS-håndbok',
       'Virksomhetens samlede HMS-dokumentasjon iht. Internkontrollforskriften og Arbeidsmiljøloven.',
       'hms_handbook', '📋', 'active'),
      (gen_random_uuid()::text, v_org, 'Policyer og retningslinjer',
       'Interne retningslinjer og personalpolicyer.',
       'policy', '📜', 'active'),
      (gen_random_uuid()::text, v_org, 'Veiledninger',
       'Praktiske veiledninger og rollebeskrivelser.',
       'guide', '📖', 'active');
  end if;
end;
$$;

grant execute on function public.wiki_ensure_org_defaults() to authenticated;
