-- Demo org: grant nav permissions added after initial demo seed (reports, workflow, HR, documents).

insert into public.role_permissions (role_id, permission_key)
select rd.id, p.permission_key
from public.role_definitions rd
cross join (
  values
    ('module.view.reports'),
    ('module.view.workflow'),
    ('module.view.hr_compliance'),
    ('documents.manage')
) as p(permission_key)
where rd.organization_id = '00000000-0000-4000-a000-000000000001'
  and rd.slug = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select rd.id, p.permission_key
from public.role_definitions rd
cross join (
  values
    ('module.view.reports'),
    ('module.view.workflow'),
    ('module.view.hr_compliance')
) as p(permission_key)
where rd.organization_id = '00000000-0000-4000-a000-000000000001'
  and rd.slug = 'member'
on conflict do nothing;
