-- Register survey module per org (nav + module toggles use modules.slug = 'survey')
insert into public.modules (organization_id, slug, display_name, is_active, required_permissions, config)
select
  o.id,
  'survey',
  'Organisasjonsundersøkelse',
  true,
  '["module.view.survey"]'::jsonb,
  '{"anonymityThreshold": 5, "actionThreshold": 60, "recurrenceMonths": 12}'::jsonb
from public.organizations o
on conflict (organization_id, slug) do update
set
  display_name = excluded.display_name,
  is_active = excluded.is_active,
  required_permissions = excluded.required_permissions,
  updated_at = now();
