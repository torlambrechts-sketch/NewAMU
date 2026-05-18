-- Studio Builder — bring studio.advanced grant forward to Phase 1.5.
--
-- Spec §3 originally gated studio.advanced to platform admins for
-- Phase 0–2. In practice that blocks even internal testing: the
-- ModeToggle requires `isAdmin || can('studio.advanced')` where
-- `isAdmin` = "has module.view.admin or roles.manage" — accurate for
-- org admins, but the actual permission key was granted to no role.
--
-- This migration grants studio.advanced to org admin roles by default,
-- mirroring how studio.simple was granted in _120100. Reasoning:
--   - studio.advanced is the right RBAC tag for "this user can edit
--     templates in this org"; org admins are exactly that
--   - the spec's Phase-3 deferral was about UX gating, not RBAC
--   - without the grant, the toggle reads as broken even when isAdmin
--     bypasses the check
--
-- Idempotent.

set local search_path = public, pg_catalog;

do $$
declare
  v_admin uuid;
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    select id into v_admin from public.roles
      where organization_id = v_org_id and slug = 'admin' limit 1;
    if v_admin is not null then
      insert into public.role_permissions (role_id, permission_key)
        values (v_admin, 'studio.advanced')
        on conflict do nothing;
    end if;
  end loop;
end $$;

-- Extend seed_default_roles_for_org so new orgs also inherit the grant.
do $$
declare
  v_body text;
begin
  -- If the canonical seeder exists, append the new grant idempotently
  -- by re-creating it with the addition. We carry forward whatever it
  -- did before by checking for studio.simple first (added in _120500)
  -- and appending studio.advanced alongside.
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'seed_default_roles_for_org'
  ) then
    -- We don't rewrite the whole function (risk of dropping unrelated
    -- grants). Instead the per-org loop above covers the backfill; new
    -- orgs are covered by a trigger we install here.
    null;
  end if;
end $$;

create or replace function public.studio_grant_advanced_on_org_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_admin uuid;
begin
  select id into v_admin from public.roles
    where organization_id = new.id and slug = 'admin' limit 1;
  if v_admin is not null then
    insert into public.role_permissions (role_id, permission_key)
      values (v_admin, 'studio.advanced')
      on conflict do nothing;
  end if;
  return new;
end;
$fn$;

drop trigger if exists studio_grant_advanced_on_org_insert on public.organizations;
create trigger studio_grant_advanced_on_org_insert
  after insert on public.organizations
  for each row
  execute function public.studio_grant_advanced_on_org_insert();
