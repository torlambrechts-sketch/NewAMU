-- Studio Builder — fix grant_/revoke_studio_partner_admin notification inserts.
--
-- 20260914121500 shipped the grant/revoke RPCs but their compliance_notifications
-- inserts didn't populate `recipient_user_id` (NOT NULL) or `notification_key`
-- (NOT NULL). The RPC body would raise 23502 the moment it was actually called.
-- Confirmed via execute_sql against the dev DB (2026-05-18).
--
-- This migration re-creates both functions with:
--   - recipient_user_id = the member's user_id (already in scope)
--   - notification_key  = deterministic key so the on-conflict-do-nothing
--                          dedupes a repeat grant within the same partner
--                          rather than firing duplicate notifications.
--
-- Idempotent: create or replace.

set local search_path = public, pg_catalog;

create or replace function public.grant_studio_partner_admin(
  p_role_id uuid,
  p_partner_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id uuid;
begin
  if not public.platform_is_admin() then
    raise exception 'Only platform admins can grant studio.partner_admin.' using errcode = 'P0001';
  end if;

  insert into public.role_permissions (role_id, permission_key)
    values (p_role_id, 'studio.partner_admin')
    on conflict do nothing;

  if exists (
    select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'partner_memberships'
  ) then
    for v_user_id in
      select pm.user_id from public.partner_memberships pm
        where pm.partner_id = p_partner_id and pm.active = true and pm.role_id = p_role_id
    loop
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, payload, severity,
        title, body, notification_key
      ) values (
        (select organization_id from public.profiles where id = v_user_id),
        v_user_id,
        'studio_partner_grant_granted',
        jsonb_build_object('partner_id', p_partner_id, 'role_id', p_role_id, 'granted_by', auth.uid()),
        'low',
        'Studio Partner-tilgang aktivert',
        'Du har fått tilgang til studio.partner_admin for partner-organisasjonen.',
        format('studio_partner_grant_granted:%s:%s:%s', p_partner_id, p_role_id, v_user_id)
      )
      on conflict (recipient_user_id, notification_key) do nothing;
    end loop;
  end if;

  return true;
end;
$fn$;

create or replace function public.revoke_studio_partner_admin(
  p_role_id uuid,
  p_partner_id uuid,
  p_reason text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id uuid;
  v_grace timestamptz := now() + interval '30 days';
begin
  if not public.platform_is_admin() then
    raise exception 'Only platform admins can revoke studio.partner_admin.' using errcode = 'P0001';
  end if;

  delete from public.role_permissions
    where role_id = p_role_id and permission_key = 'studio.partner_admin';

  if exists (
    select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'partner_memberships'
  ) then
    for v_user_id in
      select pm.user_id from public.partner_memberships pm
        where pm.partner_id = p_partner_id and pm.role_id = p_role_id
    loop
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, payload, severity,
        title, body, notification_key
      ) values (
        (select organization_id from public.profiles where id = v_user_id),
        v_user_id,
        'studio_partner_grant_revoked',
        jsonb_build_object('partner_id', p_partner_id, 'role_id', p_role_id, 'revoked_by', auth.uid(), 'grace_until', v_grace, 'reason', p_reason),
        'high',
        'Studio Partner-tilgang tilbakekalt',
        'Tilgangen til studio.partner_admin er trukket tilbake. Aktive utkast forblir tilgjengelige for klient-admins i 30 dager.',
        format('studio_partner_grant_revoked:%s:%s:%s:%s', p_partner_id, p_role_id, v_user_id, extract(epoch from now())::bigint)
      )
      on conflict (recipient_user_id, notification_key) do nothing;
    end loop;
  end if;

  return true;
end;
$fn$;
