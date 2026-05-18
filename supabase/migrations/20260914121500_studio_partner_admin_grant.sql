-- Studio Builder — grant_studio_partner_admin(role_id, partner_id) RPC.
--
-- Phase 3 ladder: studio.partner_admin is reserved (Task 0.2) but not
-- granted to any role by default. This RPC is the canonical grant path
-- when a partner-organisation upgrades to the Partner tier. Effects:
--   1. Inserts role_permissions(role_id, 'studio.partner_admin') if
--      missing (idempotent).
--   2. Optionally takes a partner_id for audit-trail purposes (echoed
--      into compliance_notifications studio_partner_grant_granted —
--      category already shipped in Task 0.6).
--
-- Symmetric revoke_studio_partner_admin(role_id, partner_id, reason)
-- removes the grant + emits studio_partner_grant_revoked, with the
-- grace_until calculated from the offboarding TTL (Task 3.4).
--
-- Caller authorization: must be platform_is_admin() — the tier-upgrade
-- gesture is a platform-side operation, not a customer-admin one.
-- Returns true on success.
--
-- Conditional on partner_organizations + partner_memberships existing.
-- Idempotent.

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

  -- Emit a notification for every user holding the role + having an
  -- active membership in the partner so the studio inbox lights up.
  if exists (
    select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'partner_memberships'
  ) then
    for v_user_id in
      select pm.user_id
        from public.partner_memberships pm
        where pm.partner_id = p_partner_id
          and pm.active = true
          and pm.role_id = p_role_id
    loop
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, payload, severity,
        title, body
      ) values (
        (select organization_id from public.profiles where id = v_user_id),
        v_user_id,
        'studio_partner_grant_granted',
        jsonb_build_object('partner_id', p_partner_id, 'role_id', p_role_id, 'granted_by', auth.uid()),
        'info',
        'Studio Partner-tilgang aktivert',
        'Du har fått tilgang til studio.partner_admin for partner-organisasjonen.'
      )
      on conflict do nothing;
    end loop;
  end if;

  return true;
end;
$fn$;

comment on function public.grant_studio_partner_admin(uuid, uuid) is
  'Studio Builder Phase 3 — grant studio.partner_admin to a role + notify members. Platform-admin gated.';

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
      select pm.user_id
        from public.partner_memberships pm
        where pm.partner_id = p_partner_id
          and pm.role_id = p_role_id
    loop
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, payload, severity,
        title, body
      ) values (
        (select organization_id from public.profiles where id = v_user_id),
        v_user_id,
        'studio_partner_grant_revoked',
        jsonb_build_object('partner_id', p_partner_id, 'role_id', p_role_id, 'revoked_by', auth.uid(), 'grace_until', v_grace, 'reason', p_reason),
        'warning',
        'Studio Partner-tilgang tilbakekalt',
        'Tilgangen til studio.partner_admin er trukket tilbake. Aktive utkast forblir tilgjengelige for klient-admins i 30 dager.'
      )
      on conflict do nothing;
    end loop;
  end if;

  return true;
end;
$fn$;

comment on function public.revoke_studio_partner_admin(uuid, uuid, text) is
  'Studio Builder Phase 3 — revoke studio.partner_admin + notify members. Platform-admin gated. Drafts purge via separate 30d TTL trigger.';
