-- Schedule T-minus reminders for government-deadline actions.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: GDPR Art. 33 (72-timers melding til Datatilsynet)
--   og AML § 5-2 (24-timers melding til Arbeidstilsynet ved alvorlig skade).
--   Katalogen seedet reminderHoursBeforeDeadline=[…] siden _20260905121100,
--   men ingen kode planla varslene — `lateSubmission=true` ble flagget
--   *etter* at fristen var passert i stedet for at T-48/T-24/T-2 hindret
--   forsinkelsen. § 5-2 og GDPR Art. 33 var i praksis reaktive.
--   Restrisiko deferred: reminder-planlegging avhenger av at action-payloaden
--   inneholder awareAt (GDPR) eller eventAt (Arbeidstilsynet). Når feltet
--   mangler hopper planleggeren stille over og logger NOTICE — manuelle
--   regulator-flyter må selv stemple anker-tidspunktet.

-- ─── 1. Idempotency key on workflow_action_queue ───────────────────────────
-- Without a unique key, a worker retry of the parent gov-action would
-- re-enqueue the same T-48 / T-24 / T-2 row. We add a nullable text column
-- with a partial unique index so existing inserts (no key) keep working
-- and only reminder rows are deduped.

alter table public.workflow_action_queue
  add column if not exists idempotency_key text;

create unique index if not exists workflow_action_queue_idempotency_uk
  on public.workflow_action_queue (idempotency_key)
  where idempotency_key is not null;

comment on column public.workflow_action_queue.idempotency_key is
  'Optional dedupe key for retry-safe enqueues (e.g. reminder scheduler uses sha256(run_id|rule_id|N) so T-N hours never gets double-scheduled).';

-- ─── 2. workflow_schedule_reminders() ──────────────────────────────────────
-- Reads p_action->'reminderHoursBeforeDeadline' (jsonb array of numbers)
-- and p_action->>'deadlineHours' (integer). Computes:
--   deadline    = p_anchor + deadlineHours
--   reminder_at = deadline  - N hours, for each N in the list
-- Only future reminders are scheduled. Each insert carries an idempotency
-- key per (run_id, rule_id, N) so worker retries are safe.

create or replace function public.workflow_schedule_reminders(
  p_org           uuid,
  p_run_id        uuid,
  p_rule_id       uuid,
  p_action        jsonb,
  p_anchor        timestamptz,
  p_role_or_user  text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours_arr    jsonb;
  v_deadline_hrs numeric;
  v_deadline     timestamptz;
  v_hr           numeric;
  v_reminder_at  timestamptz;
  v_key          text;
  v_scheduled    int := 0;
  v_action_type  text;
begin
  if p_anchor is null then
    raise notice 'workflow_schedule_reminders: anchor is null for run %, skipping', p_run_id;
    return 0;
  end if;

  v_hours_arr := p_action->'reminderHoursBeforeDeadline';
  if v_hours_arr is null or jsonb_typeof(v_hours_arr) <> 'array'
     or jsonb_array_length(v_hours_arr) = 0 then
    return 0;
  end if;

  v_deadline_hrs := nullif(p_action->>'deadlineHours', '')::numeric;
  if v_deadline_hrs is null then
    raise notice 'workflow_schedule_reminders: deadlineHours missing for run %, skipping', p_run_id;
    return 0;
  end if;

  v_action_type := coalesce(p_action->>'type', 'gov_action');
  v_deadline    := p_anchor + (v_deadline_hrs || ' hours')::interval;

  for v_hr in select (value::text)::numeric
                from jsonb_array_elements(v_hours_arr)
  loop
    v_reminder_at := v_deadline - (v_hr || ' hours')::interval;
    if v_reminder_at <= now() then
      continue;
    end if;

    v_key := encode(
      public.digest(
        coalesce(p_run_id::text, '') || '|' ||
        coalesce(p_rule_id::text, '') || '|' ||
        v_action_type || '|' ||
        v_hr::text || '|reminder',
        'sha256'
      ),
      'hex'
    );

    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, status, execute_after,
      idempotency_key
    ) values (
      p_org, p_rule_id, 'send_notification',
      jsonb_build_object(
        'type',                 'send_notification',
        'title',                'Frist nærmer seg',
        'message',              'Reguleringsfrist om ' || v_hr::text ||
                                ' timer for ' || v_action_type || '.',
        'toRole',               p_role_or_user,
        'reminderHoursBefore',  v_hr,
        'deadline',             v_deadline,
        'parentActionType',     v_action_type,
        'run_id',               p_run_id,
        'rule_id',              p_rule_id
      ),
      'pending',
      v_reminder_at,
      v_key
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing;

    v_scheduled := v_scheduled + 1;
  end loop;

  return v_scheduled;
end;
$$;

grant execute on function public.workflow_schedule_reminders(
  uuid, uuid, uuid, jsonb, timestamptz, text
) to service_role;

comment on function public.workflow_schedule_reminders(
  uuid, uuid, uuid, jsonb, timestamptz, text
) is
  'Plans T-N hours-before-deadline reminders for a gov action. Reads reminderHoursBeforeDeadline + deadlineHours from the action payload, computes deadline = p_anchor + deadlineHours, inserts one send_notification row per future N. Idempotent via (run_id|rule_id|action_type|N) sha256 key.';

-- ─── 3. Patch workflow_execute_actions to call the scheduler ───────────────
-- Replaces the gov-types CASE branch from _20260905121300 with a version
-- that, after enqueuing the gov action, also schedules its reminders. The
-- anchor is awareAt (GDPR Art. 33) or eventAt (AML § 5-2 / Arbeidstilsynet),
-- falling back to now() so the chain still produces a deadline even when
-- the caller forgot the anchor — a NOTICE is logged in that case.
-- Everything else preserved verbatim.

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
    -- Patched: after enqueuing the gov action, schedule its reminders so
    -- T-N hours-before-deadline notifications fire *before* the deadline.
    elsif v_type = any(v_gov_types) then
      insert into public.workflow_action_queue
        (organization_id, rule_id, action_type, payload, status, execute_after)
      values
        (p_org_id, p_rule_id, v_type,
         a || coalesce(p_context, '{}'::jsonb) || jsonb_build_object('run_id', v_run_id),
         'pending', now());

      -- Reminder scheduling: only when the action carries the planning hints.
      if (a ? 'reminderHoursBeforeDeadline') and (a ? 'deadlineHours') then
        -- Anchor preference: awareAt (GDPR Art. 33), then eventAt
        -- (AML § 5-2), then context-supplied, finally now() as last resort.
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
  'Master action dispatcher. Inline for create_task + log_only; queues wait_until / request_approval / escalate / on_error / gov-action types / email-class; delegates the rest to execute_workflow_action. After enqueuing a gov action with reminderHoursBeforeDeadline + deadlineHours, schedules T-N reminders via workflow_schedule_reminders so deadlines stop being reactive flags.';
