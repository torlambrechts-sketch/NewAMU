-- Studio Builder — fix Task 0.2 wiring: extend seed_default_roles_for_org
-- so newly-onboarded orgs actually inherit studio.simple.
--
-- The original Task 0.2 migration (20260914120100_studio_permissions.sql)
-- created a separate function studio_seed_default_studio_permissions(uuid)
-- which is NEVER called by the org bootstrap path. The canonical bootstrap
-- function is public.seed_default_roles_for_org(uuid), last recreated in
-- 20260907124200_tilsynsbrev_role_perm_seed.sql. That function lists the
-- admin permission grants explicitly — and without this fix, studio.simple
-- is missing from that list, so new orgs never get the grant.
--
-- The existing bulk grant in _120100 backfills existing orgs correctly
-- (every admin/manager role across every org got studio.simple). This
-- migration only fixes the future-org path.
--
-- Pattern: same as the tilsynsbrev migration — `create or replace function`
-- with the FULL body copied verbatim from the most recent definition, plus
-- the new permission appended to the admin role's permissions block.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 (systemet skal sikre at
--   ansvar/myndighet er på plass FRA første dag). Without this fix new
--   tenants would have to manually grant studio.simple — friction at the
--   exact moment they're set up, when onboarding momentum matters most.
--   Restrisiko deferred: studio.advanced / studio.packs / etc. are still
--   reserved (not auto-granted); tier rollout (Phase 3) wires them.
--
-- Idempotent: `create or replace function` is itself idempotent. The
-- function body uses `on conflict do nothing` for the permission grants.

set local search_path = public, pg_catalog;

create or replace function public.seed_default_roles_for_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (
    exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id and is_org_admin)
    or (
      exists (select 1 from public.profiles where id = auth.uid() and organization_id = p_org_id)
      and not exists (select 1 from public.role_definitions where organization_id = p_org_id)
    )
  ) then
    raise exception 'Only org admin can seed roles (or first-time seed when no roles exist)';
  end if;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (p_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (p_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = p_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = p_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.council'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'module.view.workflow'),
      (r_admin, 'workflows.manage'),
      (r_admin, 'workflows.compose'),
      (r_admin, 'workflows.activate'),
      (r_admin, 'workflows.activate_external'),
      (r_admin, 'workflows.view_confidential'),
      (r_admin, 'tilsynsbrev.upload'),
      (r_admin, 'tilsynsbrev.view_confidential'),
      (r_admin, 'tasks.view_confidential'),
      (r_admin, 'module.view.admin'),
      -- Studio Builder Phase 0 (this migration):
      (r_admin, 'studio.simple')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.council'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports'),
      (r_member, 'module.view.workflow')
    on conflict do nothing;
  end if;
end;
$$;

-- Backfill safety: verify every existing org's admin role has studio.simple.
-- The original _120100 bulk grant already did this; this DO block is a
-- belt-and-braces sanity check that fires on every redeploy. The output
-- shows in psql log so an operator can spot a partial-rollout problem.
do $$
declare
  v_admin_count int;
  v_org_count int;
begin
  select count(*) into v_admin_count
    from public.role_permissions rp
    join public.role_definitions rd on rd.id = rp.role_id
   where rd.slug = 'admin'
     and rp.permission_key = 'studio.simple';
  select count(*) into v_org_count
    from public.role_definitions where slug = 'admin';
  raise notice 'studio_seed_default_roles_for_org_fix: % admin roles have studio.simple (% total admin roles)', v_admin_count, v_org_count;
end$$;

-- The standalone studio_seed_default_studio_permissions() function from
-- _120100 is kept as a callable helper (e.g. for ad-hoc grants to manager
-- or other custom roles), but it's no longer the primary path. The
-- comment on it is updated to reflect that.
comment on function public.studio_seed_default_studio_permissions(uuid) is
  'Studio Builder — ad-hoc grant of studio.simple to admin+manager roles for a given org. Auto-grant for new orgs now goes through seed_default_roles_for_org (see 20260914120500_studio_seed_roles_fix.sql).';
