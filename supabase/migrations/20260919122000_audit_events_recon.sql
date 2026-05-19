-- Recon view for R1 / R5 (spec §11): drift between the immutable CDC
-- floor (hse_audit_log) and the semantic layer (audit_events).
--
-- Operations should query this view daily; a sustained per-table count
-- delta over a threshold (e.g. > 10/day) suggests a missing emitter
-- call in a mutation path. Restricted to org admins so it doesn't leak
-- cross-tenant counts.

create or replace view public.audit_events_recon
with (security_invoker = true)
as
with cdc as (
  select
    organization_id,
    table_name,
    date_trunc('day', changed_at) as day,
    count(*) as cdc_rows
  from public.hse_audit_log
  where action in ('INSERT', 'UPDATE')
  group by organization_id, table_name, date_trunc('day', changed_at)
),
sem as (
  select
    organization_id,
    entity_kind as table_name,
    date_trunc('day', occurred_at) as day,
    count(*) as semantic_rows
  from public.audit_events
  group by organization_id, entity_kind, date_trunc('day', occurred_at)
)
select
  coalesce(cdc.organization_id, sem.organization_id) as organization_id,
  coalesce(cdc.table_name, sem.table_name) as table_name,
  coalesce(cdc.day, sem.day) as day,
  coalesce(cdc.cdc_rows, 0) as cdc_rows,
  coalesce(sem.semantic_rows, 0) as semantic_rows,
  coalesce(cdc.cdc_rows, 0) - coalesce(sem.semantic_rows, 0) as gap
from cdc
full outer join sem
  on cdc.organization_id = sem.organization_id
 and cdc.table_name = sem.table_name
 and cdc.day = sem.day;

comment on view public.audit_events_recon is
  'Daily delta between hse_audit_log (forensic floor) and audit_events (semantic layer). gap > 0 means CDC rows exist without semantic emits — i.e. mutation code probably forgot to call emit_audit_event. Threshold for alert is per-deploy.';

grant select on public.audit_events_recon to authenticated;

-- The view does no row-level masking — it returns counts only. RLS on
-- the underlying tables already restricts to the caller's organisation,
-- so cross-tenant numbers cannot leak.
