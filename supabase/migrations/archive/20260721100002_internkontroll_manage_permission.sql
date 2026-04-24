-- Grant org admins the app permission used by useInternkontroll (canManage).
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'internkontroll.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
