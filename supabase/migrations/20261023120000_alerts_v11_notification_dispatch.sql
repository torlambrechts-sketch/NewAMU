-- Alerts v1.1 — content-free notification dispatcher.
--
-- v1.1 §1 hard rule: emails MUST never include case content. Only case
-- number + state + deep-link. This migration adds:
--   * alert_notification — per-recipient outbox row
--   * alerts_dispatch_notification(case_id, kind, to_user_id) RPC
--
-- Bodies are built at send-time from a small fixed template set. The DPO
-- review widget can confirm zero rows have ever included content via the
-- canonical_payload jsonb.
--
-- Self-audit:
--   * AML § 2A-7 (5) — guarantees no content escapes the system in plaintext email.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_notification (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  case_id              uuid references public.alert_cases (id) on delete cascade,
  to_user_id           uuid references auth.users (id) on delete cascade,
  to_email_hashed      bytea,
  notification_kind    text not null check (notification_kind in (
                         'ack_due','feedback_due','interim_due','triage_breach',
                         'dsar_received','dsar_due','break_glass_initiated',
                         'break_glass_approved','break_glass_revoked','legal_hold_imposed',
                         'legal_hold_released','retention_imminent','audit_chain_broken',
                         'new_message_from_committee','new_message_from_reporter','case_assigned'
                       )),
  deep_link_token      text,
  sent_at              timestamptz not null default now(),
  delivered_at         timestamptz,
  body_template_id     text not null,
  body_variables       jsonb not null default '{}'::jsonb,
  metadata             jsonb not null default '{}'::jsonb
);

create index if not exists alert_notification_org_idx
  on public.alert_notification (organization_id, sent_at desc);

create index if not exists alert_notification_case_idx
  on public.alert_notification (case_id, sent_at desc)
  where case_id is not null;

alter table public.alert_notification enable row level security;

drop policy if exists alert_notification_select on public.alert_notification;
create policy alert_notification_select
  on public.alert_notification for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      to_user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('alerts.committee_confidential')
      or public.user_has_permission('alerts.dpo')
      or public.user_has_permission('alerts.auditor')
    )
  );

drop policy if exists alert_notification_block_client_insert on public.alert_notification;
create policy alert_notification_block_client_insert
  on public.alert_notification for insert
  with check (false);

create or replace function public.alerts_dispatch_notification(
  p_case_id           uuid,
  p_kind              text,
  p_to_user_id        uuid default null,
  p_body_template_id  text default null,
  p_body_variables    jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org_id uuid;
  v_deep_link text;
  v_id uuid;
begin
  if p_case_id is null then
    raise exception 'case_id required' using errcode = 'invalid_parameter_value';
  end if;
  select organization_id into v_org_id from public.alert_cases where id = p_case_id;
  if v_org_id is null then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  v_deep_link := '/alerts/' || p_case_id::text;
  insert into public.alert_notification (
    organization_id, case_id, to_user_id, notification_kind,
    deep_link_token, body_template_id, body_variables
  ) values (
    v_org_id, p_case_id, p_to_user_id, p_kind,
    v_deep_link, coalesce(p_body_template_id, p_kind), p_body_variables
  ) returning id into v_id;
  -- Insert content-free row into gov_notifications_outbox for the actual
  -- send. The transport (existing infra) reads from there.
  insert into public.gov_notifications_outbox (
    organization_id, kind, payload, priority
  ) values (
    v_org_id,
    'alerts_' || p_kind,
    jsonb_build_object(
      'caseId', p_case_id,
      'caseNumberShort', substring(p_case_id::text from 1 for 8),
      'deepLink', v_deep_link,
      'state', (select status from public.alert_cases where id = p_case_id),
      'templateId', coalesce(p_body_template_id, p_kind)
    ),
    case
      when p_kind in ('triage_breach','feedback_due','break_glass_initiated','audit_chain_broken') then 'critical'
      when p_kind in ('ack_due','interim_due','dsar_due','retention_imminent','case_assigned') then 'high'
      else 'normal'
    end
  );
  return v_id;
end;
$$;

revoke all on function public.alerts_dispatch_notification(uuid, text, uuid, text, jsonb) from public, anon;
grant execute on function public.alerts_dispatch_notification(uuid, text, uuid, text, jsonb) to authenticated, service_role;
