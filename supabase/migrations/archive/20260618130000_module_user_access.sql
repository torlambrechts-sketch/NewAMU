-- Per-user, per-module access overrides.
-- access_level: 'none' | 'read' | 'write' | 'inherit'
-- 'inherit' means the user's role-based permissions apply (default behaviour).
-- 'none'    hides the module from the user entirely.
-- 'read'    grants view-only access regardless of roles.
-- 'write'   grants full access regardless of roles.

create table if not exists public.module_user_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  module_slug text not null,
  access_level text not null default 'inherit'
    check (access_level in ('none', 'read', 'write', 'inherit')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, module_slug)
);

create index if not exists module_user_access_org_idx
  on public.module_user_access (organization_id);
create index if not exists module_user_access_user_idx
  on public.module_user_access (organization_id, user_id);
create index if not exists module_user_access_module_idx
  on public.module_user_access (organization_id, module_slug);

drop trigger if exists module_user_access_set_updated_at on public.module_user_access;
create trigger module_user_access_set_updated_at
  before update on public.module_user_access
  for each row execute function public.set_updated_at();

alter table public.module_user_access enable row level security;

-- Org members can read access overrides (needed for the nav to filter on the client).
drop policy if exists "module_user_access_select_org" on public.module_user_access;
create policy "module_user_access_select_org"
  on public.module_user_access for select
  using (organization_id = public.current_org_id());

-- Only org admins can write access overrides.
drop policy if exists "module_user_access_write_admin" on public.module_user_access;
create policy "module_user_access_write_admin"
  on public.module_user_access for all
  using (
    organization_id = public.current_org_id()
    and public.is_org_admin()
  )
  with check (
    organization_id = public.current_org_id()
    and public.is_org_admin()
  );
