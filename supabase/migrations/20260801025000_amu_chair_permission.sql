-- AMU: separate permission for signing referat / årsrapport (møteleder)
insert into public.role_permissions (role_id, permission_key)
select rd.id, 'amu.chair'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
