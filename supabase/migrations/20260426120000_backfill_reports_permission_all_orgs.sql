-- Ensure admin + member roles in every org include module.view.reports (for explicit grants / future use).
-- Explicit grants for `module.view.reports` (nav / route use this for /reports).

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.reports'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict (role_id, permission_key) do nothing;
