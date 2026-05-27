-- Alerts v1.1 — break-the-glass workflow RPCs.
--
-- v1.1 §1: two-person approval, 72h auto-expire, hard-alert to all admin/dpo/committee.
-- RPCs:
--   alerts_break_glass_initiate(justification_encrypted, key_version)
--   alerts_break_glass_approve(session_id)
--   alerts_break_glass_revoke(session_id, reason)
--
-- Self-audit:
--   * AML § 2A-2 (3) — break-glass authority documented.
--   * ISO 27001 A.5.18 — privileged-access controls.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.alerts_break_glass_initiate(
  p_justification_encrypted bytea,
  p_key_version             integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid := public.current_org_id();
  v_user uuid := auth.uid();
  v_id uuid;
  v_recipient record;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.user_has_permission('alerts.board_escalation') then
    raise exception 'requires_board_escalation' using errcode = 'insufficient_privilege';
  end if;
  if p_justification_encrypted is null or octet_length(p_justification_encrypted) = 0 then
    raise exception 'justification_required' using errcode = 'check_violation';
  end if;
  insert into public.alert_break_glass_session
    (organization_id, initiated_by, justification_encrypted, justification_key_version)
  values (v_org_id, v_user, p_justification_encrypted, p_key_version)
  returning id into v_id;

  -- Hard-alert to every admin / dpo / committee_confidential holder via the
  -- notification dispatcher. We loop role_permissions to find the recipient
  -- user ids.
  for v_recipient in
    select distinct rp.user_id
      from public.role_permissions rp
      where rp.organization_id = v_org_id
        and rp.permission_key in ('alerts.committee_confidential','alerts.dpo','alerts.board_escalation')
  loop
    insert into public.alert_notification (
      organization_id, case_id, to_user_id, notification_kind,
      deep_link_token, body_template_id, body_variables
    ) values (
      v_org_id, null, v_recipient.user_id, 'break_glass_initiated',
      '/alerts/admin/break-glass', 'break_glass_initiated',
      jsonb_build_object('sessionId', v_id, 'initiatedBy', v_user)
    );
  end loop;
  return v_id;
end;
$$;

revoke all on function public.alerts_break_glass_initiate(bytea, integer) from public, anon;
grant execute on function public.alerts_break_glass_initiate(bytea, integer) to authenticated;

create or replace function public.alerts_break_glass_approve(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session record;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;
  if not public.user_has_permission('alerts.board_escalation') then
    raise exception 'requires_board_escalation' using errcode = 'insufficient_privilege';
  end if;
  select * into v_session from public.alert_break_glass_session where id = p_session_id;
  if v_session.id is null then
    raise exception 'session_not_found' using errcode = 'no_data_found';
  end if;
  if v_session.state <> 'pending' then
    raise exception 'session_not_pending' using errcode = 'check_violation';
  end if;
  if v_session.initiated_by = v_user then
    raise exception 'two_person_rule_violation' using errcode = 'check_violation';
  end if;
  update public.alert_break_glass_session
     set approved_by = v_user,
         approved_at = now(),
         state = 'active',
         expires_at = now() + interval '72 hours'
   where id = p_session_id;
  -- Hard-alert to all admins that the session has gone active.
  insert into public.alert_notification (
    organization_id, case_id, to_user_id, notification_kind,
    deep_link_token, body_template_id, body_variables
  )
  select v_session.organization_id, null, rp.user_id, 'break_glass_approved',
         '/alerts/admin/break-glass', 'break_glass_approved',
         jsonb_build_object('sessionId', p_session_id, 'initiatedBy', v_session.initiated_by, 'approvedBy', v_user)
    from public.role_permissions rp
    where rp.organization_id = v_session.organization_id
      and rp.permission_key in ('alerts.committee_confidential','alerts.dpo','alerts.board_escalation');
end;
$$;

revoke all on function public.alerts_break_glass_approve(uuid) from public, anon;
grant execute on function public.alerts_break_glass_approve(uuid) to authenticated;

create or replace function public.alerts_break_glass_revoke(p_session_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_session record;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;
  if not (public.is_org_admin() or public.user_has_permission('alerts.board_escalation')) then
    raise exception 'requires_admin' using errcode = 'insufficient_privilege';
  end if;
  select * into v_session from public.alert_break_glass_session where id = p_session_id;
  if v_session.id is null then
    raise exception 'session_not_found' using errcode = 'no_data_found';
  end if;
  if v_session.state not in ('pending','active') then
    raise exception 'session_not_revocable' using errcode = 'check_violation';
  end if;
  update public.alert_break_glass_session
     set state = 'revoked',
         revoked_at = now(),
         revoked_by = v_user,
         revoke_reason = p_reason
   where id = p_session_id;
  insert into public.alert_notification (
    organization_id, case_id, to_user_id, notification_kind,
    deep_link_token, body_template_id, body_variables
  )
  select v_session.organization_id, null, rp.user_id, 'break_glass_revoked',
         '/alerts/admin/break-glass', 'break_glass_revoked',
         jsonb_build_object('sessionId', p_session_id, 'reason', p_reason)
    from public.role_permissions rp
    where rp.organization_id = v_session.organization_id
      and rp.permission_key in ('alerts.committee_confidential','alerts.dpo','alerts.board_escalation');
end;
$$;

revoke all on function public.alerts_break_glass_revoke(uuid, text) from public, anon;
grant execute on function public.alerts_break_glass_revoke(uuid, text) to authenticated;
