-- Wire `module.view.meetings` into new-org role provisioning.
--
-- Why
--   Phase F (PR #237) dropped `module.view.council` from the typed
--   PermissionKey allowlist + cleaned the existing rows. But two RPCs
--   that run on every new org creation still hardcoded the legacy
--   permission and didn't insert the new one:
--
--     - public.seed_default_roles_for_org(p_org_id uuid)
--         redefined in archive/20260619120200_seed_roles_reports_manage.sql
--     - public.create_organization_with_brreg(text, text, jsonb)
--         redefined in archive/20260402120100_org_creation_admin_roles.sql
--
--   Without this migration, new orgs after the meetings module shipped
--   would (a) get `module.view.council` inserted as an orphan text key,
--   and (b) NOT get `module.view.meetings`, so users couldn't reach
--   /meetings.
--
-- What this migration does
--   - Re-creates both functions, dropping `module.view.council` from
--     both admin and member role permission sets, and inserting
--     `module.view.meetings` into both.
--   - Backfills `module.view.meetings` for every existing role that
--     used to hold `module.view.council` so existing orgs see the
--     new module without an admin having to grant the permission
--     manually. We grant via inference (admin / member roles in
--     role_definitions) rather than touching auth.users directly.
--
-- Acceptance
--   - select * from role_permissions where permission_key = 'module.view.council';
--     -> 0 rows on a fresh DB (the F3 cleanup already deletes them, but
--        re-running create_organization_with_brreg would re-insert.
--        After this migration it doesn't.)
--   - select count(*) from role_permissions where permission_key = 'module.view.meetings';
--     -> matches the count of admin + member role definitions.

-- ── 1. seed_default_roles_for_org ─────────────────────────────────────────

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
      (r_admin, 'module.view.meetings'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.reports'),
      (r_admin, 'reports.manage'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.meetings'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning'),
      (r_member, 'module.view.reports')
    on conflict do nothing;
  end if;
end;
$$;

-- ── 2. create_organization_with_brreg ─────────────────────────────────────

create or replace function public.create_organization_with_brreg(
  p_orgnr text,
  p_name text,
  p_brreg jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  r_admin uuid;
  r_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and organization_id is not null) then
    raise exception 'Profile already linked to an organization';
  end if;
  if p_orgnr is null or p_orgnr !~ '^\d{9}$' then
    raise exception 'Invalid organization number (9 digits)';
  end if;
  insert into public.organizations (organization_number, name, brreg_snapshot)
  values (p_orgnr, trim(p_name), p_brreg)
  returning id into v_org_id;

  update public.profiles
  set organization_id = v_org_id, is_org_admin = true
  where id = auth.uid();

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values
    (v_org_id, 'admin', 'Administrator', 'Full tilgang til brukere, roller og invitasjoner', true),
    (v_org_id, 'member', 'Medlem', 'Standard tilgang til moduler', true)
  on conflict (organization_id, slug) do nothing;

  select id into r_admin from public.role_definitions where organization_id = v_org_id and slug = 'admin';
  select id into r_member from public.role_definitions where organization_id = v_org_id and slug = 'member';

  if r_admin is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_admin, 'users.invite'),
      (r_admin, 'users.manage'),
      (r_admin, 'roles.manage'),
      (r_admin, 'delegation.manage'),
      (r_admin, 'module.view.dashboard'),
      (r_admin, 'module.view.meetings'),
      (r_admin, 'module.view.members'),
      (r_admin, 'module.view.org_health'),
      (r_admin, 'module.view.hse'),
      (r_admin, 'module.view.internal_control'),
      (r_admin, 'module.view.tasks'),
      (r_admin, 'module.view.learning'),
      (r_admin, 'module.view.admin')
    on conflict do nothing;
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (auth.uid(), r_admin, auth.uid())
    on conflict do nothing;
  end if;

  if r_member is not null then
    insert into public.role_permissions (role_id, permission_key) values
      (r_member, 'module.view.dashboard'),
      (r_member, 'module.view.meetings'),
      (r_member, 'module.view.members'),
      (r_member, 'module.view.org_health'),
      (r_member, 'module.view.hse'),
      (r_member, 'module.view.internal_control'),
      (r_member, 'module.view.tasks'),
      (r_member, 'module.view.learning')
    on conflict do nothing;
  end if;

  return v_org_id;
end;
$$;

-- ── 3. Backfill existing orgs ─────────────────────────────────────────────
-- Grant module.view.meetings to every admin + member role that exists.
-- Idempotent: ON CONFLICT DO NOTHING.

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'module.view.meetings'
from public.role_definitions rd
where rd.slug in ('admin', 'member')
on conflict do nothing;
