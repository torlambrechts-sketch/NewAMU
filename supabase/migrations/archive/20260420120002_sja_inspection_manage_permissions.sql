-- Module-scoped manage permissions for SJA and inspection (align with app permissionKeys + hooks).
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'sja.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'inspection.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
