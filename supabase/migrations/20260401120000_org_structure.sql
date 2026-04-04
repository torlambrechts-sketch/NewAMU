-- Organization-centric schema: Brønnøysund org.nr., departments, teams, locations, directory members.
-- Run in Supabase SQL Editor or via CLI. Enable Anonymous sign-in in Authentication → Providers.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_number text not null,
  name text not null,
  brreg_snapshot jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_orgnr_format check (organization_number ~ '^\d{9}$'),
  constraint organizations_orgnr_unique unique (organization_number)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  display_name text not null default 'Bruker',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists departments_org_idx on public.departments (organization_id);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  address text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists locations_org_idx on public.locations (organization_id);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists teams_org_idx on public.teams (organization_id);

-- Directory entries (HR / org chart); not the same as auth users.
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name text not null,
  email text,
  department_id uuid references public.departments (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  location_id uuid references public.locations (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists organization_members_org_idx on public.organization_members (organization_id);

-- ---------------------------------------------------------------------------
-- Triggers: profile on signup; updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Bruker'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic org creation (avoids RLS gap: insert org then link profile before SELECT)
-- ---------------------------------------------------------------------------

create or replace function public.create_organization_with_brreg(
  p_orgnr text,
  p_name text,
  p_brreg jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and organization_id is not null) then
    raise exception 'Profile already linked to an organization';
  end if;
  if p_orgnr is null or p_orgnr !~ '^\d{9}$' then
    raise exception 'Invalid organization number (9 digits)';
  end if;
  insert into public.organizations (organization_number, name, brreg_snapshot)
  values (p_orgnr, trim(p_name), p_brreg)
  returning id into v_org_id;
  update public.profiles
  set organization_id = v_org_id
  where id = auth.uid();
  return v_org_id;
end;
$$;

grant execute on function public.create_organization_with_brreg(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.teams enable row level security;
alter table public.locations enable row level security;
alter table public.organization_members enable row level security;

-- Profiles: own row
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- Organizations: visible if member
create policy "organizations_select_member"
  on public.organizations for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organizations.id
    )
  );

create policy "organizations_update_member"
  on public.organizations for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organizations.id
    )
  );

-- Link profile to org (wizard): user updates own profile
-- Already covered by profiles_update_own if we allow setting organization_id once:
-- Add check in app; RLS allows update of own profile.

-- Child tables: same org as profile
create policy "departments_all_org"
  on public.departments for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = departments.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = departments.organization_id
    )
  );

create policy "teams_all_org"
  on public.teams for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = teams.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = teams.organization_id
    )
  );

create policy "locations_all_org"
  on public.locations for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = locations.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = locations.organization_id
    )
  );

create policy "organization_members_all_org"
  on public.organization_members for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organization_members.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.organization_id = organization_members.organization_id
    )
  );
