-- Register Vernerunder in org module toggles (nav «Nye moduler» uses modules.slug = 'vernerunder')
insert into public.modules (organization_id, slug, display_name, is_active, required_permissions, config)
select
  o.id,
  'vernerunder',
  'Vernerunder',
  true,
  '["module.view.hse"]'::jsonb,
  '{}'::jsonb
from public.organizations o
on conflict (organization_id, slug) do update
set
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  required_permissions = excluded.required_permissions,
  updated_at = now();
