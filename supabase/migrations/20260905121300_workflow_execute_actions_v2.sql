-- Extend workflow_execute_actions with the new action types.
--
-- Today (archive/_20260420120000) the master dispatcher only handles
-- create_task + log_only inline. The newer per-action dispatcher
-- execute_workflow_action (_20260829120011) handles more types but is
-- called from a different path (workflow_fire_rule). The phase A
-- substrate added five more action types — request_approval, wait_until,
-- on_error, parallel, escalate — plus five government action types. This
-- migration teaches workflow_execute_actions to:
--   * Recognise the new internal types and queue or short-circuit
--     correctly.
--   * For government action types: queue to workflow_action_queue with
--     status='pending' so the edge-function worker
--     (supabase/functions/workflow-queue-worker) picks them up. We never
--     execute regulator HTTP calls inside Postgres — they're queued.
--   * For request_approval: queue with status='awaiting_approval' AND
--     insert the workflow_approvals row so the approver UI surfaces it.
--   * For wait_until: queue with execute_after set, status='pending'.
--     The worker will pick it up and dispatch the next action.
--   * For escalate: queue and record the escalation reason in
--     workflow_runs.detail (no immediate side effect — caller is expected
--     to chain it after request_approval expiry).
--
-- The legacy create_task path stays inline (so old rules keep working).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — alle automatiserte tiltak
--   må kunne spores fra trigger til kvittering. Tidligere kunne
--   regulator-actions kreve manuell håndtering — de blir nå garantert
--   køet og signert via Maskinporten.
--   Restrisiko deferred: synkron godkjenningsutløp ved BankID-mobil
--   kommer i Phase E sprint-2. Inntil da brukes auth.uid().

create or replace function public.workflow_execute_actions(
  p_org_id  uuid,
  p_rule_id uuid,
  p_actions jsonb,
  p_context jsonb
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
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, 'wait_until',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', v_execute_at);

    -- ── request_approval (pauses the chain) ────────────────────────────
    elsif v_type = 'request_approval' then
      v_approval_role := coalesce(a->>'approverRole', 'hms_leder');
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, 'request_approval',
         a || coalesce(p_context, '{}'::jsonb),
         'awaiting_approval', now())
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
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, 'escalate',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now());

    -- ── parallel (fan-out: execute each branch's actions recursively) ──
    elsif v_type = 'parallel' then
      for v_branch in select jsonb_array_elements(coalesce(a->'branches', '[]'::jsonb))
      loop
        perform public.workflow_execute_actions(
          p_org_id, p_rule_id,
          coalesce(v_branch->'actions', '[]'::jsonb),
          p_context
        );
      end loop;

    -- ── on_error (queue for the worker to chain on prior failure) ──────
    elsif v_type = 'on_error' then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, 'on_error',
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now());

    -- ── Government action types (worker dispatches via edge fn) ────────
    elsif v_type = any(v_gov_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb) || jsonb_build_object('run_id', v_run_id),
         'pending', now());

    -- ── External-dispatch types (email/notification/webhook) ───────────
    elsif v_type = any(v_external_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb),
         'pending', now());

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

comment on function public.workflow_execute_actions(uuid, uuid, jsonb, jsonb) is
  'Master action dispatcher. Inline for create_task + log_only; queues wait_until / request_approval / escalate / on_error / gov-action types / email-class; delegates the rest to execute_workflow_action. Worker drains the queue.';
