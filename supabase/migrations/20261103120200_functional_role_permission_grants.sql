-- Functional roles → permission grants (H3.3)
--
-- Gap closed: assigning a functional role (verneombud, DPO, AMU-medlem …)
-- was bookkeeping only — it never granted the matching PermissionKeys, so an
-- admin could appoint a verneombud who still couldn't open varslingssaker
-- (alerts.verneombud). A global bridge table maps role slugs to permission
-- keys, and a sync function materialises them through the EXISTING
-- permission machinery: per-org role_definitions row ('fr_<slug>', system)
-- + role_permissions from the bridge + user_roles membership while the
-- assignment is active.
--
-- Self-audit (Arbeidstilsynet POV): rolle og tilgang følger nå hverandre
-- sporbart (AML § 6-5 verneombudets innsyn; § 2A-7 varslingsmottak).
-- Restrisiko: valid_to expiry is not event-driven — triggers cover
-- insert/update/delete, and functional_roles_reconcile_org() exists for a
-- cron/reconcile pass (wire into role-compliance-reconcile as follow-up).
--
-- usage:
--   select functional_roles_reconcile_org('<org_id>');

create table if not exists public.functional_role_permission_grants (
  role_slug      text not null references public.functional_roles (slug) on delete cascade,
  permission_key text not null,
  primary key (role_slug, permission_key)
);

comment on table public.functional_role_permission_grants is
  'Global katalog: hvilke PermissionKeys en funksjonell rolle gir. '
  'Materialiseres per org som role_definitions(fr_<slug>) + role_permissions '
  'av functional_role_sync_permissions().';

alter table public.functional_role_permission_grants enable row level security;

drop policy if exists frpg_select_all on public.functional_role_permission_grants;
create policy frpg_select_all
  on public.functional_role_permission_grants for select
  using (auth.uid() is not null);
-- No write policies: catalog is seed-managed.

-- Seed — the role/permission pairs the modules already gate on. Idempotent.
insert into public.functional_role_permission_grants (role_slug, permission_key) values
  ('verneombud',            'alerts.verneombud'),
  ('hoved_verneombud',      'alerts.verneombud'),
  ('dpo',                   'alerts.dpo'),
  ('tillitsvalgt',          'alerts.tillitsvalgt'),
  ('amu_leder',             'meetings.manage'),
  ('amu_sekretar',          'meetings.manage'),
  ('hms_koordinator',       'tasks.view_confidential'),
  ('daglig_leder',          'alerts.committee_escalated'),
  ('daglig_leder',          'meetings.manage')
on conflict (role_slug, permission_key) do nothing;

-- Materialise grants for one (org, user, role) tuple. Creates the per-org
-- system role definition on demand, refreshes its permission set from the
-- bridge, and adds/removes the user_roles membership depending on whether an
-- ACTIVE assignment exists today.
create or replace function public.functional_role_sync_permissions(
  p_org_id uuid,
  p_user_id uuid,
  p_role_slug text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role_id uuid;
  v_label text;
  v_active boolean;
begin
  -- Defense in depth: when called by a user (triggers/service role have
  -- auth.uid() null), the caller must be an admin of the SAME org. Without
  -- this, any authenticated user could write role_definitions/
  -- role_permissions rows into other tenants' RBAC config.
  if auth.uid() is not null
     and (p_org_id is distinct from public.current_org_id() or not public.is_org_admin()) then
    raise exception 'Kun org-admin kan synkronisere rolletilganger.';
  end if;

  -- Nothing mapped for this functional role → nothing to materialise.
  if not exists (
    select 1 from public.functional_role_permission_grants g where g.role_slug = p_role_slug
  ) then
    return;
  end if;

  select label into v_label from public.functional_roles where slug = p_role_slug;

  insert into public.role_definitions (organization_id, slug, name, description, is_system)
  values (
    p_org_id,
    'fr_' || p_role_slug,
    coalesce(v_label, p_role_slug),
    'Automatisk: tilganger fra funksjonell rolle. Styres av rolletildelingen — ikke rediger manuelt.',
    true
  )
  on conflict (organization_id, slug) do update set name = excluded.name
  returning id into v_role_id;

  -- Refresh the permission set from the bridge (handles seed changes).
  delete from public.role_permissions rp
   where rp.role_id = v_role_id
     and rp.permission_key not in (
       select g.permission_key from public.functional_role_permission_grants g
        where g.role_slug = p_role_slug
     );
  insert into public.role_permissions (role_id, permission_key)
  select v_role_id, g.permission_key
    from public.functional_role_permission_grants g
   where g.role_slug = p_role_slug
  on conflict do nothing;

  select exists (
    select 1
      from public.org_functional_role_assignments a
     where a.organization_id = p_org_id
       and a.user_id = p_user_id
       and a.role_slug = p_role_slug
       and a.valid_from <= current_date
       and (a.valid_to is null or a.valid_to >= current_date)
  ) into v_active;

  if v_active then
    insert into public.user_roles (user_id, role_id, assigned_by)
    values (p_user_id, v_role_id, auth.uid())
    on conflict do nothing;
  else
    delete from public.user_roles ur
     where ur.user_id = p_user_id and ur.role_id = v_role_id;
  end if;
end;
$$;

grant execute on function public.functional_role_sync_permissions(uuid, uuid, text) to authenticated;

-- Reconcile every mapped assignment in an org (expiry sweep / repair).
create or replace function public.functional_roles_reconcile_org(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  -- Same gate as functional_role_sync_permissions: org-admin of p_org_id,
  -- or service role (auth.uid() null) for the cron/reconcile path.
  if auth.uid() is not null
     and (p_org_id is distinct from public.current_org_id() or not public.is_org_admin()) then
    raise exception 'Kun org-admin kan rekonsiliere rolletilganger.';
  end if;

  for r in
    select distinct a.user_id, a.role_slug
      from public.org_functional_role_assignments a
     where a.organization_id = p_org_id
  loop
    perform public.functional_role_sync_permissions(p_org_id, r.user_id, r.role_slug);
  end loop;
end;
$$;

grant execute on function public.functional_roles_reconcile_org(uuid) to authenticated;

-- Triggers: assignment lifecycle → sync.
create or replace function public.functional_role_assignment_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    perform public.functional_role_sync_permissions(
      old.organization_id, old.user_id, old.role_slug);
    return old;
  end if;
  perform public.functional_role_sync_permissions(
    new.organization_id, new.user_id, new.role_slug);
  -- Re-key on update (user or role changed): clean up the old tuple too.
  if tg_op = 'UPDATE'
     and (old.user_id <> new.user_id or old.role_slug <> new.role_slug) then
    perform public.functional_role_sync_permissions(
      old.organization_id, old.user_id, old.role_slug);
  end if;
  return new;
end;
$$;

drop trigger if exists functional_role_assignment_sync on public.org_functional_role_assignments;
create trigger functional_role_assignment_sync
  after insert or update or delete on public.org_functional_role_assignments
  for each row execute function public.functional_role_assignment_sync();
