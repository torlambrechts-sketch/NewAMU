-- Bugfix: the previous hardening migration created audit_events_read with
-- `security_invoker = true` while *also* revoking SELECT on the base
-- audit_events table. Those two settings are mutually exclusive — the
-- view ran as the caller, and the caller no longer had access to the
-- underlying table, so every SELECT through the view failed with
-- "permission denied for table audit_events".
--
-- Correct pattern for a masking view: keep base SELECT revoked (B1
-- mitigation: callers cannot bypass the diff/summary mask by querying
-- the base directly) and switch the view to definer mode. The view
-- inlines the org-membership and audit.read check that the base RLS
-- would otherwise have performed. The diff/summary CASE expressions
-- continue to mask privileged events for readers without
-- audit.read.privileged.

drop view if exists public.audit_events_read;

create view public.audit_events_read as
select
  id, organization_id, occurred_at,
  actor_user_id, actor_name, actor_initials, actor_role,
  actor_is_external, actor_external_label,
  action, entity_kind, entity_id,
  room_entity_kind, room_entity_id,
  scope_id, location,
  case
    when privileged and not public.user_has_permission('audit.read.privileged')
      then 'Privilegert hendelse — kontakt admin for tilgang.'
    else summary_nb
  end as summary_nb,
  case
    when privileged and not public.user_has_permission('audit.read.privileged')
      then null
    else diff
  end as diff,
  privileged, hse_audit_log_id
from public.audit_events
where
  organization_id = public.current_org_id()
  and (
    public.is_org_admin()
    or public.user_has_permission('audit.read')
  );

grant select on public.audit_events_read to authenticated;

comment on view public.audit_events_read is
  'Privilege-aware read surface for audit_events. Runs as definer (base SELECT is revoked, B1). The WHERE clause replicates the RLS check; the CASE expressions mask diff/summary for non-privileged readers on privileged rows.';
