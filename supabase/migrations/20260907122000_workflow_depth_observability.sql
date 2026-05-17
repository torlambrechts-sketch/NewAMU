-- Observability surface for queue-depth distribution.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 1 — systematisk overvåking. Etter
--   at vi flyttet dybde-tellingen til kø-raden (_121900) trenger drift en
--   måte å se om noen regler nærmer seg taket på 5 før alarmer/run-skipped
--   skjer i prod. Visningen er aggregert pr (organization_id, depth) slik
--   at den ikke lekker payloads, og er org-skopet via current_org_id().
--   Restrisiko deferred: per-rule-aggregering kommer som dashboard-widget
--   i Phase C (compliance gap-and-audit planner-pakken).

-- Aggregated view: one row per (org, depth) with counts.
-- Bucketed by status to make stuck/failed rows visible at a glance.
create or replace view public.workflow_depth_distribution
with (security_invoker = true) as
select
  q.organization_id,
  q.depth,
  q.status,
  count(*)::bigint                                  as row_count,
  count(*) filter (where q.status = 'pending')      as pending_count,
  count(*) filter (where q.status = 'processing')   as processing_count,
  count(*) filter (where q.status = 'failed')       as failed_count,
  count(*) filter (where q.status = 'done')         as done_count,
  count(*) filter (where q.last_error
                         like 'WORKFLOW_DEPTH_EXCEEDED%')
                                                    as depth_exceeded_count,
  min(q.created_at)                                 as oldest_row_at,
  max(q.updated_at)                                 as latest_update_at
from public.workflow_action_queue q
group by q.organization_id, q.depth, q.status;

comment on view public.workflow_depth_distribution is
  'Ops-facing aggregate: how deep is the queue, per org? Useful for alerting when a rule approaches depth=5 (WORKFLOW_DEPTH_EXCEEDED). Security-invoker so RLS on workflow_action_queue applies — service_role + org-admins (via the queue table policies) see their own rows.';

-- service_role drains the queue and ships metrics; authenticated org-admins
-- see their org's rows through the underlying table RLS (security_invoker).
grant select on public.workflow_depth_distribution to authenticated, service_role;
