-- If organization_number already exists (another user registered it), join that org instead of failing.

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
  r_admin uuid;
  r_member uuid;
  existing_id uuid;
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

  select id into existing_id
  from public.organizations
  where organization_number = p_orgnr
  limit 1;

  if existing_id is not null then
    update public.profiles
    set organization_id = existing_id, is_org_admin = coalesce(is_org_admin, false)
    where id = auth.uid();
    return existing_id;
  end if;

  insert into public.organizations (organization_number, name, brreg_snapshot)
  values (p_orgnr, trim(p_name), p_brreg)
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id, is_org_admin = true
  where id = auth.uid();

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (v_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (v_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = v_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = v_org_id and slug = 'member';

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
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (auth.uid(), r_admin, auth.uid())
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

  return v_org_id;
end;
$$;
