-- Alerts v1.1 — alerts_bulk_reassign + alerts_bulk_recategorise RPCs.
--
-- v1.1 §6: bulk operations on multiple cases. Each affected case writes a
-- bulk_op timeline event with the actor + previous values. The RPCs are
-- transactional — either all cases update or none do.
--
-- Self-audit:
--   * GDPR Art. 5 (2) — bulk operations are processing acts; per-case
--     audit row makes them inspectable.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.alerts_bulk_reassign(
  p_case_ids       uuid[],
  p_new_handler_id uuid,
  p_reason         text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case      record;
  v_count     integer := 0;
  v_user_id   uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;
  if not (
    public.is_org_admin()
    or public.user_has_permission('alerts.committee')
    or public.user_has_permission('alerts.committee_confidential')
    or public.user_has_permission('alerts.committee_escalated')
  ) then
    raise exception 'role_not_permitted' using errcode = 'insufficient_privilege';
  end if;

  for v_case in
    select * from public.alert_cases
     where id = any(p_case_ids)
       and organization_id = public.current_org_id()
     for update
  loop
    update public.alert_cases
       set assigned_committee_member_ids = array[p_new_handler_id]
     where id = v_case.id;
    insert into public.alert_case_timeline_events
      (case_id, organization_id, event_kind, actor_kind, actor_user_id, payload)
    values (v_case.id, v_case.organization_id, 'assigned', 'committee', v_user_id,
            jsonb_build_object(
              'bulk_op', 'reassign',
              'new_handler', p_new_handler_id,
              'previous_handlers', v_case.assigned_committee_member_ids,
              'reason', p_reason
            ));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.alerts_bulk_reassign(uuid[], uuid, text) from public, anon;
grant execute on function public.alerts_bulk_reassign(uuid[], uuid, text) to authenticated;

create or replace function public.alerts_bulk_recategorise(
  p_case_ids     uuid[],
  p_category_id  uuid,
  p_reason       text default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case      record;
  v_count     integer := 0;
  v_user_id   uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;
  if not (
    public.is_org_admin()
    or public.user_has_permission('alerts.committee')
    or public.user_has_permission('alerts.committee_confidential')
    or public.user_has_permission('alerts.committee_escalated')
  ) then
    raise exception 'role_not_permitted' using errcode = 'insufficient_privilege';
  end if;

  for v_case in
    select * from public.alert_cases
     where id = any(p_case_ids)
       and organization_id = public.current_org_id()
     for update
  loop
    update public.alert_cases
       set category_id = p_category_id
     where id = v_case.id;
    insert into public.alert_case_timeline_events
      (case_id, organization_id, event_kind, actor_kind, actor_user_id, payload)
    values (v_case.id, v_case.organization_id, 'status_changed', 'committee', v_user_id,
            jsonb_build_object(
              'bulk_op', 'recategorise',
              'new_category_id', p_category_id,
              'previous_category_id', v_case.category_id,
              'reason', p_reason
            ));
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.alerts_bulk_recategorise(uuid[], uuid, text) from public, anon;
grant execute on function public.alerts_bulk_recategorise(uuid[], uuid, text) to authenticated;
