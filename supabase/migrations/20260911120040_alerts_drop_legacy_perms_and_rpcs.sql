-- Phase F4 — drop legacy permission rows + public RPCs.
-- Idempotent. Runs after Phase F2 has copied grants and Phase D's legacy
-- shim RPCs are no longer referenced by App.tsx routes (they redirect to
-- the new endpoints).

set local search_path = public, pg_catalog;

-- Drop legacy permission grants
delete from public.role_permissions where permission_key in (
  'whistleblowing.committee',
  'whistleblowing.view',
  'whistleblowing.assign',
  'module.view.workplace_reporting'
);

-- Drop legacy RPCs (legacy /varsle/:slug URL goes to a redirect in App.tsx;
-- the redirect calls public_submit_alert directly)
drop function if exists public.public_submit_whistleblowing(text,text,text,text,text,text,boolean,text,text);
drop function if exists public.public_whistleblowing_status(uuid);
drop function if exists public.public_whistleblowing_org_lookup(text);

-- Drop legacy whistle_public_slug column. Trigger already renamed to alerts.
alter table public.organizations drop column if exists whistle_public_slug;
