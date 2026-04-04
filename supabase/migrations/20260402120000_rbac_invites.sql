-- RBAC, invitations, delegation. Run after 20260401120000_org_structure.sql
-- Enable Email provider in Supabase Auth. Disable anonymous for production if desired.

-- ---------------------------------------------------------------------------
-- Profiles extension
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_org_admin boolean not null default false;

comment on column public.profiles.is_org_admin is 'Bootstrap full org admin; also use roles for fine-grained access.';

create index if not exists profiles_org_idx on public.profiles (organization_id);

-- ---------------------------------------------------------------------------
-- Roles & permissions (permission_key = app-defined string)
-- ---------------------------------------------------------------------------

create table if not exists public.role_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  constraint role_definitions_org_slug unique (organization_id, slug)
);

create index if not exists role_definitions_org_idx on public.role_definitions (organization_id);

create table if not exists public.role_permissions (
  role_id uuid not null references public.role_definitions (id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.role_definitions (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role_id)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  token text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitations_token_unique unique (token)
);

create index if not exists invitations_org_idx on public.invitations (organization_id);
create index if not exists invitations_email_idx on public.invitations (organization_id, lower(email));

create table if not exists public.invitation_roles (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  role_id uuid not null references public.role_definitions (id) on delete cascade,
  primary key (invitation_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Delegation (admin delegates a role to another user for a period)
-- ---------------------------------------------------------------------------

create table if not exists public.role_delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_id uuid not null references public.role_definitions (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint role_delegations_no_self check (from_user_id <> to_user_id)
);

create index if not exists role_delegations_to_idx on public.role_delegations (to_user_id, ends_at);
create index if not exists role_delegations_org_idx on public.role_delegations (organization_id);

-- ---------------------------------------------------------------------------
-- Helper: org id for current user
-- ---------------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_org_admin from public.profiles where id = p_user),
    false
  );
$$;

create or replace function public.user_has_permission(p_key text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_org_admin(p_user)
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.role_definitions rd on rd.id = ur.role_id
      where ur.user_id = p_user
        and rp.permission_key = p_key
        and rd.organization_id = (select organization_id from public.profiles where id = p_user)
    )
    or exists (
      select 1
      from public.role_delegations d
      join public.role_permissions rp on rp.role_id = d.role_id
      where d.to_user_id = p_user
        and d.ends_at > now()
        and d.starts_at <= now()
        and rp.permission_key = p_key
        and d.organization_id = (select organization_id from public.profiles where id = p_user)
    );
$$;

-- ---------------------------------------------------------------------------
-- Seed default roles for an organization (call from app after org creation)
-- ---------------------------------------------------------------------------

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning')
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.seed_default_roles_for_org(uuid) to authenticated;

-- Assign admin role to org admin user (first setup)
create or replace function public.assign_admin_role_to_self(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin' limit 1;
  if r_admin is null then
    return;
  end if;
  insert into public.user_roles (user_id, role_id, assigned_by)
  values (auth.uid(), r_admin, auth.uid())
  on conflict do nothing;
end;
$$;

grant execute on function public.assign_admin_role_to_self(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations RPC
-- ---------------------------------------------------------------------------

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_email text;
  r record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  v_email := lower(trim((select email from auth.users where id = auth.uid())));

  select * into v_inv from public.invitations
  where token = p_token and status = 'pending' and expires_at > now();

  if v_inv.id is null then
    raise exception 'Invalid or expired invitation';
  end if;

  if lower(v_inv.email) <> v_email then
    raise exception 'Invitation email does not match your account email';
  end if;

  update public.profiles
  set organization_id = v_inv.organization_id
  where id = auth.uid();

  for r in
    select role_id from public.invitation_roles where invitation_id = v_inv.id
  loop
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (auth.uid(), r.role_id, v_inv.invited_by)
    on conflict do nothing;
  end loop;

  update public.invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where id = v_inv.id;

  return v_inv.organization_id;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.create_invitation(
  p_email text,
  p_role_ids uuid[],
  p_days_valid int default 14
)
returns table (invitation_id uuid, token text, invite_url_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
  v_token text;
  v_email text;
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  v_org := public.current_org_id();
  if v_org is null then
    raise exception 'No organization';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('users.invite')) then
    raise exception 'Not allowed';
  end if;

  v_email := lower(trim(p_email));
  if v_email is null or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Invalid email';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.invitations (organization_id, email, token, expires_at, invited_by)
  values (v_org, v_email, v_token, now() + (coalesce(p_days_valid, 14) || ' days')::interval, auth.uid())
  returning id into v_id;

  if p_role_ids is not null then
    foreach rid in array p_role_ids
    loop
      insert into public.invitation_roles (invitation_id, role_id) values (v_id, rid);
    end loop;
  end if;

  invitation_id := v_id;
  token := v_token;
  invite_url_path := '/invite/' || v_token;
  return next;
end;
$$;

grant execute on function public.create_invitation(text, uuid[], int) to authenticated;

-- ---------------------------------------------------------------------------
-- Effective permissions for client (admin = all keys in seed set)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_effective_permissions()
returns table (permission_key text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  oid uuid;
begin
  if auth.uid() is null then
    return;
  end if;
  select organization_id into oid from public.profiles where id = auth.uid();
  if oid is null then
    return;
  end if;

  if public.is_org_admin() then
    return query
      select distinct rp.permission_key
      from public.role_permissions rp
      join public.role_definitions rd on rd.id = rp.role_id
      where rd.organization_id = oid;
    return;
  end if;

  return query
    select distinct rp.permission_key
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.role_definitions rd on rd.id = ur.role_id
    where ur.user_id = auth.uid()
      and rd.organization_id = oid
    union
    select distinct rp.permission_key
    from public.role_delegations d
    join public.role_permissions rp on rp.role_id = d.role_id
    where d.to_user_id = auth.uid()
      and d.organization_id = oid
      and d.ends_at > now()
      and d.starts_at <= now();
end;
$$;

grant execute on function public.get_my_effective_permissions() to authenticated;

-- ---------------------------------------------------------------------------
-- Sync profile email from auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Bruker'),
    new.email
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(nullif(profiles.display_name, ''), excluded.display_name);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: drop old restrictive policies where needed, add new
-- ---------------------------------------------------------------------------

-- Profiles: same-org visibility
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_org"
  on public.profiles for select
  using (
    id = auth.uid()
    or (
      organization_id is not null
      and organization_id = (select organization_id from public.profiles p2 where p2.id = auth.uid())
    )
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (
    id = auth.uid()
    or (
      public.is_org_admin()
      and organization_id = (select organization_id from public.profiles where id = auth.uid())
      and profiles.organization_id = (select organization_id from public.profiles where id = auth.uid())
    )
  );

-- role_definitions
alter table public.role_definitions enable row level security;

create policy "role_definitions_select_org"
  on public.role_definitions for select
  using (organization_id = public.current_org_id());

create policy "role_definitions_manage_admin"
  on public.role_definitions for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('roles.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('roles.manage'))
  );

-- role_permissions
alter table public.role_permissions enable row level security;

create policy "role_permissions_select_org"
  on public.role_permissions for select
  using (
    exists (
      select 1 from public.role_definitions rd
      where rd.id = role_permissions.role_id and rd.organization_id = public.current_org_id()
    )
  );

create policy "role_permissions_manage_admin"
  on public.role_permissions for all
  using (
    exists (
      select 1 from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('roles.manage'))
    )
  )
  with check (
    exists (
      select 1 from public.role_definitions rd
      where rd.id = role_permissions.role_id
        and rd.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('roles.manage'))
    )
  );

-- user_roles
alter table public.user_roles enable row level security;

create policy "user_roles_select_org"
  on public.user_roles for select
  using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from public.role_definitions rd
        where rd.id = user_roles.role_id and rd.organization_id = public.current_org_id()
      )
      and (public.is_org_admin() or public.user_has_permission('users.manage'))
    )
  );

create policy "user_roles_manage"
  on public.user_roles for insert
  with check (
    public.is_org_admin() or public.user_has_permission('users.manage')
  );

create policy "user_roles_delete"
  on public.user_roles for delete
  using (
    public.is_org_admin() or public.user_has_permission('users.manage')
  );

-- invitations
alter table public.invitations enable row level security;

create policy "invitations_select_org"
  on public.invitations for select
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('users.invite'))
  );

create policy "invitations_insert_org"
  on public.invitations for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('users.invite'))
  );

create policy "invitations_update_org"
  on public.invitations for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('users.invite'))
  );

-- invitation_roles
alter table public.invitation_roles enable row level security;

create policy "invitation_roles_select"
  on public.invitation_roles for select
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_roles.invitation_id and i.organization_id = public.current_org_id()
    )
  );

create policy "invitation_roles_write"
  on public.invitation_roles for all
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_roles.invitation_id
        and i.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('users.invite'))
    )
  )
  with check (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_roles.invitation_id
        and i.organization_id = public.current_org_id()
        and (public.is_org_admin() or public.user_has_permission('users.invite'))
    )
  );

-- role_delegations
alter table public.role_delegations enable row level security;

create policy "role_delegations_select"
  on public.role_delegations for select
  using (
    organization_id = public.current_org_id()
    and (
      from_user_id = auth.uid()
      or to_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('delegation.manage')
    )
  );

create policy "role_delegations_write"
  on public.role_delegations for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('delegation.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('delegation.manage'))
  );
