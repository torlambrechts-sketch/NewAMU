-- Alerts v1.1 — dashboard helper views for the analyse page.
--
-- Pre-computed SQL views drive the v1.1 widgets:
--   * alert_dashboard_sla_state — per-case SLA clock state per kind
--   * alert_dashboard_anonymity_share — distribution over anonymity_mode
--   * alert_dashboard_retention_horizon — bucketed days-to-retention
--   * alert_dashboard_dsar_30d_burn — DSAR rows by days-to-due bucket
--   * alert_dashboard_break_glass_activity — active + recently-expired
--
-- Self-audit:
--   * ISAE 3000 / ISO 27001 — dashboard tiles inform the AMU annual
--     report on whistleblower system efficacy. SQL views keep the
--     definitions auditable.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace view public.alert_dashboard_sla_state as
  with cases as (
    select
      c.id,
      c.organization_id,
      c.kind,
      c.status,
      c.received_at,
      c.acknowledgement_due_at,
      c.investigation_due_at,
      c.acknowledged_at,
      c.closed_at,
      now() as now_ts
    from public.alert_cases c
  )
  select
    organization_id,
    kind,
    status,
    case
      when status in ('closed','rejected','withdrawn','dismissed') then 'stopped'
      when status in ('on_hold','awaiting_reporter_response') then 'paused'
      else 'running'
    end as feedback_clock,
    case
      when status in ('closed','rejected','withdrawn','dismissed','on_hold') then 'stopped'
      when status = 'received' then 'stopped'
      else 'running'
    end as interim_clock,
    case
      when acknowledged_at is not null then 'stopped'
      when status in ('closed','rejected','withdrawn','dismissed') then 'stopped'
      when acknowledgement_due_at < now_ts then 'breached'
      else 'running'
    end as ack_clock,
    -- Days until / since the closest deadline:
    extract(epoch from coalesce(investigation_due_at, acknowledgement_due_at) - now_ts) / 86400.0 as days_to_next_deadline,
    received_at,
    acknowledged_at,
    closed_at
  from cases;

grant select on public.alert_dashboard_sla_state to authenticated;

create or replace view public.alert_dashboard_anonymity_share as
  select organization_id, anonymity_mode, count(*)::integer as count
    from public.alert_cases
    group by organization_id, anonymity_mode;

grant select on public.alert_dashboard_anonymity_share to authenticated;

create or replace view public.alert_dashboard_retention_horizon as
  with held as (
    select case_id, true as has_hold
      from public.alert_legal_hold
      where released_at is null
  )
  select
    c.organization_id,
    case
      when h.has_hold then 'held'
      when c.retention_until is null then 'open'
      when c.retention_until < now() then 'expired'
      when c.retention_until < now() + interval '30 days' then 'lt_30d'
      when c.retention_until < now() + interval '90 days' then 'lt_90d'
      when c.retention_until < now() + interval '365 days' then 'lt_1y'
      else 'gt_1y'
    end as bucket,
    count(*)::integer as count
  from public.alert_cases c
  left join held h on h.case_id = c.id
  group by c.organization_id, bucket;

grant select on public.alert_dashboard_retention_horizon to authenticated;

create or replace view public.alert_dashboard_dsar_30d_burn as
  select
    organization_id,
    case
      when state in ('fulfilled','rejected_rights','rejected_excessive') then 'closed'
      when response_due_at < now() then 'overdue'
      when response_due_at < now() + interval '5 days' then 'lt_5d'
      when response_due_at < now() + interval '15 days' then 'lt_15d'
      else 'gt_15d'
    end as bucket,
    count(*)::integer as count
  from public.alert_dsar_request
  group by organization_id, bucket;

grant select on public.alert_dashboard_dsar_30d_burn to authenticated;

create or replace view public.alert_dashboard_break_glass_activity as
  select
    organization_id,
    state,
    count(*)::integer as count,
    min(initiated_at) as oldest_initiated_at,
    max(initiated_at) as newest_initiated_at
  from public.alert_break_glass_session
  where initiated_at > now() - interval '90 days'
  group by organization_id, state;

grant select on public.alert_dashboard_break_glass_activity to authenticated;
