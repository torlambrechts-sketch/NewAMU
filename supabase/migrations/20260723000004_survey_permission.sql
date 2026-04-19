-- Survey module: permission key + grant to admin and member roles (same pattern as ros.manage)
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.survey'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict (role_id, permission_key) do nothing;
