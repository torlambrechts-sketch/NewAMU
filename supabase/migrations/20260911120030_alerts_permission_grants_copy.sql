-- Phase F2 — copy existing role grants from legacy permission keys to the
-- new alerts.* keys. Keeps both grants live until Phase F4 drops the legacy
-- keys. Idempotent.

set local search_path = public, pg_catalog;

-- whistleblowing.committee  → alerts.committee
insert into public.role_permissions (role_id, permission_key)
  select role_id, 'alerts.committee'
    from public.role_permissions
    where permission_key = 'whistleblowing.committee'
on conflict (role_id, permission_key) do nothing;

-- whistleblowing.view → alerts.view (treated as committee-without-write —
-- map to alerts.committee since the new module has no committee.view split)
insert into public.role_permissions (role_id, permission_key)
  select role_id, 'alerts.committee'
    from public.role_permissions
    where permission_key = 'whistleblowing.view'
on conflict (role_id, permission_key) do nothing;

-- whistleblowing.assign → alerts.committee (assignment is just a write)
insert into public.role_permissions (role_id, permission_key)
  select role_id, 'alerts.committee'
    from public.role_permissions
    where permission_key = 'whistleblowing.assign'
on conflict (role_id, permission_key) do nothing;

-- module.view.workplace_reporting → module.view.alerts (umbrella view)
insert into public.role_permissions (role_id, permission_key)
  select role_id, 'module.view.alerts'
    from public.role_permissions
    where permission_key = 'module.view.workplace_reporting'
on conflict (role_id, permission_key) do nothing;

-- Admin role gets alerts.manage by default (mirrors how survey/meetings
-- behaved with their respective .manage keys).
insert into public.role_permissions (role_id, permission_key)
  select rd.id, 'alerts.manage'
    from public.role_definitions rd
    where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- Admin also gets module.view.alerts so the sidebar is visible
insert into public.role_permissions (role_id, permission_key)
  select rd.id, 'module.view.alerts'
    from public.role_definitions rd
    where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;
