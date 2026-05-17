-- C-4 fix: top-level callers should land children at depth=0, not 1.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — dokumentert 5-nivås
--   rekursjons-grense. _121800 satte v_child_depth = least(coalesce(
--   p_parent_depth, 0) + 1, 5) som meningfullt fra parent-perspektivet,
--   men 4-arg-kallerne (cron, db-triggere, top-level system rule emission)
--   sender p_parent_depth = null. Coalesce'n til 0 gjorde at top-level-
--   handlinger ble lagt i køen på depth=1 i stedet for 0 — vi mistet ett
--   nivå av den dokumenterte kaskaden (effektivt max 4 etterkommere).
--   Vi setter coalesce-defaulten til -1 så top-level lander på 0.
--   Restrisiko deferred: ingen — endringen er kompatibel med 5-arg-
--   kallerne (de fortsetter å sende eksplisitt p_parent_depth).

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
  -- C-4 patch: top-level callers (cron / db-triggers / system-rule
  -- emission) pass p_parent_depth=null, which now resolves to -1 so the
  -- child lands at depth=0. 5-arg callers (recursive parallel branches)
  -- still see depth+1 for their children. Cap at 5 so the CHECK
  -- constraint in _121900 never trips when a caller forgot to gate at
  -- the cap — the row still inserts, but the worker refuses to run it
  -- via workflow_record_depth_exceeded.
  v_child_depth int := least(coalesce(p_parent_depth, -1) + 1, 5);
  -- Reminder-scheduling locals (preserved from _907120600).
  v_anchor timestamptz;
  v_role_or_user text;
  -- Government action types that always queue for the edge worker.
  v_gov_types text[] := array[
    'rapporter_alvorlig_skade_arbeidstilsynet',
    'meld_personvernbrudd_datatilsynet',
    'varsel_ldo_export',
    'nav_sykefravar_oppfolging',
    'altinn_send_melding'
  ];
  -- External-dispatch types (worker handles HTTP / SMS / email).
  v_external_types text[] := array[
    'send_email',
    'send_notification',
    'call_webhook'
  ];
begin
  -- Resolve the run id from context (set by the trigger).
  v_run_id := (p_context->>'run_id')::uuid;

  for a in select * from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_type := a->>'type';

    -- Pull the onError siblings (if any) so we can stash them on the
    -- queue row. Triggers can supply either `onError` or `on_error`.
    v_on_error := case
      when jsonb_typeof(a->'onError') = 'array' then a->'onError'
      when jsonb_typeof(a->'on_error') = 'array' then a->'on_error'
      else null
    end;

    -- ── create_task (legacy inline path — preserved) ───────────────────
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

    -- ── log_only (legacy inline path) ──────────────────────────────────
    elsif v_type = 'log_only' then
      null;

    -- ── wait_until (queue with execute_after) ──────────────────────────
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

    -- ── request_approval (pauses the chain) ────────────────────────────
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

    -- ── escalate (log + insert escalation task) ────────────────────────
    elsif v_type = 'escalate' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'escalate',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);

    -- ── parallel (fan-out: execute each branch's actions recursively) ──
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

    -- ── on_error: declared inline alongside its parent action. Should
    --     normally be hoisted onto the parent row's on_error_actions
    --     column via the `onError` sibling field. If a stray standalone
    --     `on_error` action is ever queued from a trigger we keep the
    --     legacy queue insert so the worker can flag the misuse.
    elsif v_type = 'on_error' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, 'on_error',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);

    -- ── Government action types (worker dispatches via edge fn) ────────
    -- Preserves the reminder scheduling added in _907120600 so T-N
    -- deadline-before notifications still fire.
    elsif v_type = any(v_gov_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb) || jsonb_build_object('run_id', v_run_id),
         'pending', now(),
         v_on_error, v_child_depth);

      if (a ? 'reminderHoursBeforeDeadline') and (a ? 'deadlineHours') then
        -- Anchor preference: awareAt (GDPR Art. 33), then eventAt
        -- (AML § 5-2), then context-supplied, finally now().
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

    -- ── External-dispatch types (email/notification/webhook) ───────────
    elsif v_type = any(v_external_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after,
         on_error_actions, depth)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now(),
         v_on_error, v_child_depth);

    -- ── Catch-all: defer to execute_workflow_action for any types we
    --     don't recognise here (create_task_item, create_deviation,
    --     create_ros_draft, add_amu_agenda_item, request_signature, …)
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
  'Master action dispatcher. C-4 patch (2026-09-07): top-level callers (p_parent_depth=null) now land children at depth=0 instead of 1, restoring the documented 5-level cascade. 5-arg recursive callers still see depth+1 for children.';
