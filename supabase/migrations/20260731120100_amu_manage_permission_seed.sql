-- AMU: grant amu.manage to system admin role (same pattern as ik.manage).
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'amu.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
