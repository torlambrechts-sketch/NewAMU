-- Alerts v1.1 — alerts_execute_transition RPC.
--
-- Authoritative state-transition gate. Validates:
--   * caller has one of the allowed_roles for the (from, to) transition
--   * preconditions match (justification when required, COI cleared,
--     severity set, decision memo finalised, etc.)
--   * applies side-effects (timeline event, closed_at, etc.)
--
-- The UI mirrors the rules via modules/alerts/state/stateMachine.ts but
-- this function is the ultimate gatekeeper — every transition flows through.
--
-- Self-audit:
--   * AML § 2A-3 + § 2A-7 — formal acknowledgement + investigation
--     workflow with auditable transitions.
--   * ISO 27001 A.5.36 — privileged action with logged justification.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create or replace function public.alerts_execute_transition(
  p_case_id               uuid,
  p_to_state              text,
  p_justification         text default null,
  p_coi_declaration_id    uuid default null,
  p_assigned_handler_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_case          record;
  v_rule          record;
  v_caller_roles  text[] := array[]::text[];
  v_user_id       uuid := auth.uid();
  v_perm          text;
  v_required      jsonb;
  v_required_role boolean := false;
begin
  if v_user_id is null then
    raise exception 'unauthenticated' using errcode = 'insufficient_privilege';
  end if;

  select * into v_case from public.alert_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'case_not_found' using errcode = 'no_data_found';
  end if;
  if v_case.organization_id <> public.current_org_id() then
    raise exception 'wrong_org' using errcode = 'insufficient_privilege';
  end if;

  -- Find an org-specific rule first; fall back to platform default
  -- (organization_id is null).
  select * into v_rule
    from public.alert_workflow_transition
    where (organization_id = v_case.organization_id or organization_id is null)
      and from_state = v_case.status
      and to_state = p_to_state
      and is_active = true
    order by (organization_id is null) asc -- org-specific first
    limit 1;
  if v_rule.id is null then
    raise exception 'no_transition_rule: % → %', v_case.status, p_to_state
      using errcode = 'check_violation';
  end if;

  -- Build caller roles list.
  for v_perm in
    select unnest(v_rule.allowed_roles)
  loop
    if v_perm = 'reporter' then
      if v_case.reporter_user_id = v_user_id then
        v_caller_roles := array_append(v_caller_roles, 'reporter');
        v_required_role := true;
      end if;
    else
      if public.user_has_permission(v_perm) then
        v_caller_roles := array_append(v_caller_roles, v_perm);
        v_required_role := true;
      end if;
    end if;
  end loop;
  if not v_required_role then
    raise exception 'role_not_permitted_for_transition' using errcode = 'insufficient_privilege';
  end if;

  -- Preconditions.
  v_required := coalesce(v_rule.preconditions, '{}'::jsonb);
  if (v_required->>'requiresJustification')::boolean = true
     and (p_justification is null or trim(p_justification) = '') then
    raise exception 'justification_required' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresCoiDeclaration')::boolean = true then
    if p_coi_declaration_id is null then
      raise exception 'coi_declaration_required' using errcode = 'check_violation';
    end if;
    if not exists (
      select 1 from public.alert_coi_declaration d
      where d.id = p_coi_declaration_id
        and d.case_id = p_case_id
        and (
          d.outcome = 'cleared'
          or (d.outcome = 'requires_review' and d.review_outcome = 'cleared')
        )
    ) then
      raise exception 'coi_not_cleared' using errcode = 'check_violation';
    end if;
  end if;
  if (v_required->>'requiresAssignedHandler')::boolean = true
     and (p_assigned_handler_id is null) then
    raise exception 'assigned_handler_required' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresSeverity')::boolean = true and v_case.severity is null then
    raise exception 'severity_required' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresClosingSummary')::boolean = true
     and (v_case.closing_summary is null or trim(v_case.closing_summary) = '') then
    raise exception 'closing_summary_required' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresClosingOutcome')::boolean = true and v_case.closing_outcome is null then
    raise exception 'closing_outcome_required' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresDecisionMemoFinalised')::boolean = true
     and not public.alerts_case_has_finalised_memo(p_case_id) then
    raise exception 'decision_memo_not_finalised' using errcode = 'check_violation';
  end if;
  if (v_required->>'requiresReporterConfirmation')::boolean = true
     and 'reporter' = any (v_caller_roles)
     and v_case.reporter_user_id is distinct from v_user_id then
    raise exception 'reporter_confirmation_required' using errcode = 'check_violation';
  end if;

  -- Apply side-effects.
  if (v_rule.side_effects->>'setClosedAt')::boolean = true then
    update public.alert_cases
       set status = p_to_state,
           closed_at = coalesce(closed_at, now())
     where id = p_case_id;
  elsif (v_rule.side_effects->>'clearClosedAt')::boolean = true then
    update public.alert_cases
       set status = p_to_state,
           closed_at = null
     where id = p_case_id;
  else
    update public.alert_cases set status = p_to_state where id = p_case_id;
  end if;

  -- Add assigned handler to the committee roster if provided.
  if p_assigned_handler_id is not null then
    update public.alert_cases
       set assigned_committee_member_ids = (
         select array_agg(distinct id)
           from unnest(coalesce(assigned_committee_member_ids, '{}') || array[p_assigned_handler_id]) id
       )
     where id = p_case_id;
  end if;

  -- Timeline event.
  insert into public.alert_case_timeline_events
    (case_id, organization_id, event_kind, actor_kind, actor_user_id, payload)
  values (
    p_case_id,
    v_case.organization_id,
    coalesce(v_rule.side_effects->>'emitTimeline', 'state_changed'),
    case when 'reporter' = any (v_caller_roles) then 'reporter' else 'committee' end,
    v_user_id,
    jsonb_build_object(
      'from_state', v_case.status,
      'to_state', p_to_state,
      'justification', p_justification,
      'rule_id', v_rule.id
    )
  );
end;
$$;

revoke all on function public.alerts_execute_transition(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.alerts_execute_transition(uuid, text, text, uuid, uuid) to authenticated, service_role;
