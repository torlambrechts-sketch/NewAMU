-- Grant AMU election administration to roles that already manage internkontroll (IK admins).
insert into public.role_permissions (role_id, permission_key)
select distinct rp.role_id, 'amu_election.manage'
from public.role_permissions rp
where rp.permission_key in ('internkontroll.manage', 'ik.manage')
on conflict (role_id, permission_key) do nothing;
