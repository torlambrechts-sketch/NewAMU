-- Grant admin role to tor.lambrechts@gmail.com across all orgs they belong to.
-- Safe to re-run: ON CONFLICT DO NOTHING on user_roles PK (user_id, role_id).

do $$
declare
  v_user_id  uuid;
  v_role_id  uuid;
  v_org_id   uuid;
begin
  -- Resolve the auth user from the profile email
  select p.id into v_user_id
  from public.profiles p
  where p.email = 'tor.lambrechts@gmail.com'
  limit 1;

  if v_user_id is null then
    raise notice 'tor.lambrechts@gmail.com not found in profiles — skipping';
    return;
  end if;

  -- Set is_org_admin flag on the profile
  update public.profiles
  set is_org_admin = true
  where id = v_user_id;

  -- Assign admin role_definition in every org this user belongs to
  for v_org_id in
    select distinct organization_id
    from public.profiles
    where id = v_user_id
      and organization_id is not null
  loop
    select id into v_role_id
    from public.role_definitions
    where organization_id = v_org_id
      and slug = 'admin'
    limit 1;

    if v_role_id is not null then
      insert into public.user_roles (user_id, role_id, assigned_by)
      values (v_user_id, v_role_id, v_user_id)
      on conflict (user_id, role_id) do nothing;

      raise notice 'Admin role assigned in org %', v_org_id;
    else
      raise notice 'No admin role_definition found in org % — skipping', v_org_id;
    end if;
  end loop;
end;
$$;
