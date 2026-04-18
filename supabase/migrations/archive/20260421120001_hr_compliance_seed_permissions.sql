-- Extend seed_default_roles_for_org with HR compliance permissions.

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
      (r_admin, 'module.view.reports'),
      (r_admin, 'module.view.workflow'),
      (r_admin, 'workflows.manage'),
      (r_admin, 'module.view.hr_compliance'),
      (r_admin, 'hr.discussion.manage'),
      (r_admin, 'hr.consultation.manage'),
      (r_admin, 'hr.o_ros.manage'),
      (r_admin, 'hr.o_ros.view'),
      (r_admin, 'hr.o_ros.sign'),
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
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports'),
      (r_member, 'module.view.workflow'),
      (r_member, 'module.view.hr_compliance')
    on conflict do nothing;
  end if;
end;
$$;

insert into public.role_permissions (role_id, permission_key)
select rd.id, k
from public.role_definitions rd
cross join (
  values
    ('module.view.hr_compliance'),
    ('hr.discussion.manage'),
    ('hr.consultation.manage'),
    ('hr.o_ros.manage'),
    ('hr.o_ros.view'),
    ('hr.o_ros.sign')
) as v(k)
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.hr_compliance'
from public.role_definitions rd
where rd.slug = 'member'
on conflict (role_id, permission_key) do nothing;
