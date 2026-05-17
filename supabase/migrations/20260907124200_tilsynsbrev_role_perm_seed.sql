-- Tilsynsbrev + tasks confidentiality — role-permission seeding.
--
-- _123900 registered tilsynsbrev.upload + tilsynsbrev.view_confidential
-- and _124100 added tasks.view_confidential, but none of these keys
-- were seeded to any role. Combined with the strict-permission gates,
-- only the uploader/creator can read restricted/confidential rows —
-- HMS-leder + admin are locked out by default.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: IK-f § 5 nr. 4 (fordeling av ansvar — HMS-
--   leder + hms_koordinator må kunne se tilsynssaker som default;
--   admin må kunne se konfidensielle saker for å håndtere oppfølging).
--   AML § 18-6 (oppfølgingsansvar). Hvis ingen kan se varslede pålegg
--   pga. RLS-misalignment er det selv en pålegg-grunn (manglende
--   internkontroll-system).
--   Restrisiko deferred: hms_leder ser IKKE konfidensielle saker som
--   default — de må gis tilgang eksplisitt eller varslingsmottak må gjøre
--   det. Bevisst valg (separation of duties, AML § 2A-7-mønsteret).

set local search_path = public, pg_catalog;

-- Backfill: every admin-role across all orgs gets the three new keys.
-- Idempotent via primary key (role_id, permission_key).
insert into public.role_permissions (role_id, permission_key)
select rd.id, k
  from public.role_definitions rd
  cross join (values
    ('tilsynsbrev.upload'),
    ('tilsynsbrev.view_confidential'),
    ('tasks.view_confidential')
  ) as v(k)
 where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

-- hms_leder / hms_koordinator (the workflow-recipient slug pair —
-- see _120250_workflow_notification_dispatch for the alias mapping)
-- get upload + read-confidential rights so they can triage tilsynssaker.
-- Org-defined role slugs may vary; the WHERE matches the conventional
-- system seeds plus the alerts-committee functional roles. No-op if
-- the slug isn't present in a tenant.
insert into public.role_permissions (role_id, permission_key)
select rd.id, k
  from public.role_definitions rd
  cross join (values
    ('tilsynsbrev.upload'),
    ('tilsynsbrev.view_confidential')
  ) as v(k)
 where rd.slug in ('hms_leder','hms_koordinator','hms-leder','hms-koordinator')
on conflict (role_id, permission_key) do nothing;

-- ── Extend seed_default_roles_for_org so newly-onboarded orgs ship with
-- the keys too. Recreate verbatim with the new entries appended (matches
-- the pattern in _20260905120900_workflow_permissions.sql).
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
      (r_admin, 'module.view.admin')
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

do $$
declare
  v_admin_count int;
begin
  select count(*) into v_admin_count
    from public.role_permissions rp
    join public.role_definitions rd on rd.id = rp.role_id
   where rd.slug = 'admin'
     and rp.permission_key in (
       'tilsynsbrev.upload',
       'tilsynsbrev.view_confidential',
       'tasks.view_confidential'
     );
  raise notice 'tilsynsbrev_role_perm_seed: % admin-role permission rows seeded (3 per org expected)', v_admin_count;
end$$;
