-- Add/remove/delete admin RPCs for cross-org alert dedup groups.
-- Pålegg-grunner addressed: AML § 2A-7 (5) — multi-org konsernstrukturer
--   må kunne forvalte dedup-tilhørighet uten DBA. Restrisiko deferred:
--   ingen RLS-policy for delete på medlems-tabellen — admin-RPC bypasser
--   det med security definer. Følger _126400's eksisterende mønster.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. alert_dedup_admin_add_org — append org to existing group             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alert_dedup_admin_add_org(
  p_group_id uuid,
  p_org_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.platform_is_admin() then
    raise exception 'alert_dedup_admin_add_org: caller must be platform_admin'
      using errcode = '42501';
  end if;
  if p_group_id is null or p_org_id is null then
    raise exception 'alert_dedup_admin_add_org: both group_id and org_id are required';
  end if;
  if not exists (select 1 from public.org_alert_dedup_groups where id = p_group_id) then
    raise exception 'alert_dedup_admin_add_org: group % not found', p_group_id;
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'alert_dedup_admin_add_org: organization % not found', p_org_id;
  end if;

  -- Mirror the single-group invariant from alert_dedup_admin_create_group.
  -- If the org already belongs to a DIFFERENT group, refuse — the admin
  -- must explicitly remove it first.
  select group_id into v_existing
    from public.org_alert_dedup_group_members
   where organization_id = p_org_id
   limit 1;
  if v_existing is not null and v_existing <> p_group_id then
    raise exception 'alert_dedup_admin_add_org: organization % already belongs to dedup group %', p_org_id, v_existing;
  end if;

  insert into public.org_alert_dedup_group_members (group_id, organization_id)
  values (p_group_id, p_org_id)
  on conflict (group_id, organization_id) do nothing;
end;
$$;

revoke all on function public.alert_dedup_admin_add_org(uuid, uuid) from public;
grant execute on function public.alert_dedup_admin_add_org(uuid, uuid) to authenticated;

comment on function public.alert_dedup_admin_add_org(uuid, uuid) is
  'Platform-admin RPC. Adds an organization to an existing org_alert_dedup_group. Idempotent (on conflict do nothing). Refuses if the org already belongs to a different group — caller must remove it from the old group first via alert_dedup_admin_remove_org. AML § 2A-7 (5).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. alert_dedup_admin_remove_org — detach org from group                 │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alert_dedup_admin_remove_org(
  p_group_id uuid,
  p_org_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.platform_is_admin() then
    raise exception 'alert_dedup_admin_remove_org: caller must be platform_admin'
      using errcode = '42501';
  end if;
  if p_group_id is null or p_org_id is null then
    raise exception 'alert_dedup_admin_remove_org: both group_id and org_id are required';
  end if;

  delete from public.org_alert_dedup_group_members
   where group_id = p_group_id
     and organization_id = p_org_id;
end;
$$;

revoke all on function public.alert_dedup_admin_remove_org(uuid, uuid) from public;
grant execute on function public.alert_dedup_admin_remove_org(uuid, uuid) to authenticated;

comment on function public.alert_dedup_admin_remove_org(uuid, uuid) is
  'Platform-admin RPC. Removes one organization from an org_alert_dedup_group. After this fires the org reverts to its per-org HMAC key (alerts_text_fingerprint), so future alerts no longer match dedup against sister orgs. Existing alert_dedup_keys rows are not rewritten — they fall out of dedup naturally as their TTL expires (see _126700).';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. alert_dedup_admin_delete_group — drop entire group                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.alert_dedup_admin_delete_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;
  if not public.platform_is_admin() then
    raise exception 'alert_dedup_admin_delete_group: caller must be platform_admin'
      using errcode = '42501';
  end if;
  if p_group_id is null then
    raise exception 'alert_dedup_admin_delete_group: group_id is required';
  end if;

  -- The members rows cascade-delete via the FK (on delete cascade in _126400).
  -- alert_dedup_keys rows reference organization_id, not group_id, so they
  -- linger until TTL — see remove_org comment for rationale.
  delete from public.org_alert_dedup_groups
   where id = p_group_id;
end;
$$;

revoke all on function public.alert_dedup_admin_delete_group(uuid) from public;
grant execute on function public.alert_dedup_admin_delete_group(uuid) to authenticated;

comment on function public.alert_dedup_admin_delete_group(uuid) is
  'Platform-admin RPC. Deletes an org_alert_dedup_groups row. Cascade-removes the org_alert_dedup_group_members join rows. The previously-shared HMAC key is gone after this — sister orgs immediately stop matching dedup against each other.';

do $$
begin
  raise notice 'alert_dedup_admin add_org / remove_org / delete_group RPCs installed.';
end
$$;
