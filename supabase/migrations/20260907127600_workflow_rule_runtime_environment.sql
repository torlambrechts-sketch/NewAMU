-- Per-rule runtime_environment toggle (UX Run 2 — terrifyingly-clear
-- gov-action surface). Lets the author keep a gov-action rule pinned to
-- TT02 (sandbox) even when the org_integrations row is wired to prod, so
-- the editing user can iterate without filing real regulator submissions.
-- Defense-in-depth: defaults to 'test', and the edge fn forces TT02 when
-- payload.runtime_environment='test' regardless of org_integrations.status.

set local search_path = public, pg_catalog;

-- ── 1. Column ────────────────────────────────────────────────────────────
alter table public.workflow_rules
  add column if not exists runtime_environment text not null default 'test'
    check (runtime_environment in ('test', 'prod'));

comment on column public.workflow_rules.runtime_environment is
  'When the rule contains a gov action, dispatch to TT02 (sandbox) when runtime_environment=''test''; only to prod when ''prod''. UI requires explicit promotion via a typed-confirmation. Default is ''test'' for safety.';

-- ── 2. Re-issue workflow_execute_actions, preserving signature, so each
--      gov-action queue insert carries runtime_environment in its payload.
--      The edge worker reads body.payload.runtime_environment and forces
--      TT02 when 'test'. Activation guard is unchanged — runtime is
--      orthogonal to dual-approver gating.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.workflow_execute_actions(
  p_org_id  uuid,
  p_rule_id uuid,
  p_actions jsonb,
  p_context jsonb,
  p_parent_depth int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a jsonb;
  v_branch jsonb;
  v_type text;
  v_run_id uuid;
  v_delay_seconds int;
  v_execute_at timestamptz;
  v_queue_id uuid;
  v_approval_role text;
  v_on_error jsonb;
  v_child_depth int := least(coalesce(p_parent_depth, 0) + 1, 5);
  v_anchor timestamptz;
  v_role_or_user text;
  v_runtime_env text;
  -- Government action types that always queue for the edge worker.
  -- _126200: added `meld_helsetilsynet` for the new helse-sektor flow.
  v_gov_types text[] := array[
    'rapporter_alvorlig_skade_arbeidstilsynet',
    'meld_personvernbrudd_datatilsynet',
    'varsel_ldo_export',
    'nav_sykefravar_oppfolging',
    'altinn_send_melding',
    'meld_helsetilsynet'
  ];
  v_external_types text[] := array[
    'send_email',
    'send_notification',
    'call_webhook'
  ];
begin
  v_run_id := (p_context->>'run_id')::uuid;

  -- _127600: resolve the rule's runtime_environment up-front so every gov
  -- queue insert in this dispatch carries the same value. Default 'test'
  -- protects rules created before this column existed.
  select coalesce(runtime_environment, 'test')
    into v_runtime_env
    from public.workflow_rules
   where id = p_rule_id;
  if v_runtime_env is null then
    v_runtime_env := 'test';
  end if;

  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_type := a->>'type';
    v_on_error := case
      when jsonb_typeof(a->'onError') = 'array' then a->'onError'
      when jsonb_typeof(a->'on_error') = 'array' then a->'on_error'
      else null
    end;

    if v_type = 'create_task' then
      perform public.workflow_append_task(p_org_id, jsonb_build_object(
        'id', coalesce(a->>'id', gen_random_uuid()::text),
        'title', coalesce(a->>'title', 'Arbeidsflyt-oppgave'),
        'description', coalesce(a->>'description', ''),
        'status', 'todo',
        'assignee', coalesce(a->>'assignee', 'Ansvarlig'),
        'ownerRole', coalesce(a->>'ownerRole', 'HMS'),
        'dueDate', (current_date + (coalesce((a->>'dueInDays')::int, 7) || ' days')::interval)::date::text,
        'createdAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'module', coalesce(a->>'module', 'hse'),
        'sourceType', coalesce(a->>'sourceType', 'hse_incident'),
        'sourceId', p_context->>'sourceId',
        'sourceLabel', coalesce(a->>'sourceLabel', 'Arbeidsflyt'),
        'requiresManagementSignOff', coalesce((a->>'requiresManagementSignOff')::boolean, false)
      ));
    elsif v_type = 'log_only' then
      null;
    elsif v_type = 'wait_until' then
      v_delay_seconds := case
        when a->'delay'->>'unit' = 'minutes' then (a->'delay'->>'amount')::int * 60
        when a->'delay'->>'unit' = 'hours'   then (a->'delay'->>'amount')::int * 3600
        when a->'delay'->>'unit' = 'days'    then (a->'delay'->>'amount')::int * 86400
        when a->'delay'->>'unit' = 'weeks'   then (a->'delay'->>'amount')::int * 604800
        else 0
      end;
      v_execute_at := case
        when a->>'at' is not null then (a->>'at')::timestamptz
        else now() + make_interval(secs => v_delay_seconds)
      end;
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'wait_until',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', v_execute_at,
         v_on_error, v_child_depth);
    elsif v_type = 'request_approval' then
      v_approval_role := coalesce(a->>'approverRole', 'hms_leder');
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'request_approval',
         a || coalesce(p_context, '{}'::jsonb),
         'awaiting_approval', now(),
         v_on_error, v_child_depth)
      returning id into v_queue_id;
      insert into public.workflow_approvals
        (organization_id, rule_id, run_id, queue_id, requested_at,
         approver_role, approver_user_id, status, escalate_after, metadata)
      values
        (p_org_id, p_rule_id, v_run_id, v_queue_id, now(),
         v_approval_role,
         nullif(a->>'approverUserId','')::uuid,
         'pending',
         case when a ? 'escalateAfterHours'
              then make_interval(hours => (a->>'escalateAfterHours')::int)
              else null end,
         jsonb_build_object(
           'message', a->>'message',
           'escalateToRole', a->>'escalateToRole'
         ));
    elsif v_type = 'escalate' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'escalate',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    elsif v_type = 'parallel' then
      for v_branch in select jsonb_array_elements(coalesce(a->'branches', '[]'::jsonb))
      loop
        perform public.workflow_execute_actions(
          p_org_id, p_rule_id,
          coalesce(v_branch->'actions', '[]'::jsonb),
          p_context,
          p_parent_depth
        );
      end loop;
    elsif v_type = 'on_error' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'on_error',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    elsif v_type = any(v_gov_types) then
      -- _127600: stamp runtime_environment onto every gov payload so the
      -- edge fn can force TT02 when 'test' even if org status is 'active'.
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         jsonb_set(
           a || coalesce(p_context, '{}'::jsonb) || jsonb_build_object('run_id', v_run_id),
           '{runtime_environment}',
           to_jsonb(v_runtime_env)
         ),
         'pending', now(),
         v_on_error, v_child_depth);

      if (a ? 'reminderHoursBeforeDeadline') and (a ? 'deadlineHours') then
        v_anchor := coalesce(
          nullif(a->>'awareAt','')::timestamptz,
          nullif(a->>'eventAt','')::timestamptz,
          nullif(p_context->>'awareAt','')::timestamptz,
          nullif(p_context->>'eventAt','')::timestamptz,
          now()
        );
        v_role_or_user := coalesce(
          a->>'toRole',
          a->>'melderRolle',
          'hms_leder'
        );
        perform public.workflow_schedule_reminders(
          p_org_id, v_run_id, p_rule_id, a, v_anchor, v_role_or_user
        );
      end if;
    elsif v_type = any(v_external_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);
    else
      perform public.execute_workflow_action(
        a,
        coalesce(p_context, '{}'::jsonb) || jsonb_build_object(
          'organization_id', p_org_id,
          'rule_id', p_rule_id,
          'run_id', v_run_id
        )
      );
    end if;
  end loop;
end;
$$;

comment on function public.workflow_execute_actions(uuid, uuid, jsonb, jsonb, int) is
  'Master action dispatcher. _127600: every gov-action queue insert now carries the rule''s runtime_environment so the edge fn can force TT02 sandbox when the author has not promoted the rule to PRODUKSJON.';

do $$
begin
  raise notice 'workflow_rules.runtime_environment installed (_127600)';
end
$$;
