-- Implement on_error sibling-chain semantics for workflow_action_queue.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiserte tiltak må kunne
--   feile kontrollert. Spesifikasjonen sa at en handling kan deklarere
--   `onError: [...]` søsken som skal kjøre når den selv feiler, men kø-
--   workeren behandlet `on_error` som en no-op slik at fall-back-flyter
--   (varsel om regulator-feil, manuell oppgave) aldri ble iverksatt.
--   Vi bærer derfor onError-listen ved siden av handlingen og lar workeren
--   køe søsken via en transaksjonell RPC.
--   Restrisiko deferred: nestet onError (onError.onError) støttes ikke i
--   denne migrasjonen — søsken køes på depth=parent.depth+1 og kan ikke ha
--   egen onError. Fanges av depth-cap i _121900 hvis noen prøver.

-- ── 1. Carry onError siblings + depth + parent_queue_id on every row ──────
--     The depth + parent_queue_id columns are also written by _121900
--     (queue-row recursion-depth migration). Both ALTERs are guarded with
--     `if not exists` so basename order is irrelevant — whichever runs
--     first creates the column, the other no-ops.

alter table public.workflow_action_queue
  add column if not exists on_error_actions jsonb;

alter table public.workflow_action_queue
  add column if not exists depth int not null default 0;

alter table public.workflow_action_queue
  add column if not exists parent_queue_id uuid
    references public.workflow_action_queue (id) on delete set null;

comment on column public.workflow_action_queue.on_error_actions is
  'Sibling actions to enqueue when this row terminally fails (post-MAX_ATTEMPTS). Copied from the source action JSON `onError` field at enqueue time. Worker calls workflow_enqueue_on_error_actions() to push them as new pending rows.';

-- ── 2. Re-issue workflow_execute_actions so every queue insert captures
--      onError siblings + propagates parent depth to children. We drop
--      the prior 4-arg signature first so the new optional p_parent_depth
--      param can be added (Postgres won't accept argument-list changes
--      via create-or-replace). All callers either pass 4 args (default
--      depth=null → child rows land at depth=1) or the new 5-arg form. ─────

-- Drop both historical signatures (4-arg from _905121300 and the legacy
-- 5-arg `p_xor_branch_index` from archive/_511120000) before re-issuing
-- the new 5-arg form with `p_parent_depth`.
drop function if exists public.workflow_execute_actions(uuid, uuid, jsonb, jsonb);
drop function if exists public.workflow_execute_actions(uuid, uuid, jsonb, jsonb, int);

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
  -- Child rows are 1 deeper than the parent. Capped at 5 so the CHECK
  -- constraint in _121900 never trips when a caller forgot to gate at
  -- the cap — the row still inserts, but the worker will refuse to run
  -- it (workflow_record_depth_exceeded).
  v_child_depth int := least(coalesce(p_parent_depth, 0) + 1, 5);
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
  'Master action dispatcher. Inline for create_task + log_only; queues wait_until / request_approval / escalate / on_error / gov-action types / email-class; delegates the rest to execute_workflow_action. Stashes `onError` siblings onto the queue row and propagates depth (p_parent_depth + 1) so the queue cap stays end-to-end.';

-- ── 3. workflow_enqueue_on_error_actions ─────────────────────────────────
-- Called by the queue worker after a row terminally fails. Reads the
-- parent queue row + the on_error_actions JSON array, then enqueues
-- each sibling as a new pending row inheriting org/rule/run from the
-- parent. Idempotency key is sha256(parent_id|index|action_type) so a
-- worker double-tick can't double-enqueue.

create or replace function public.workflow_enqueue_on_error_actions(
  p_parent_id uuid,
  p_on_error jsonb default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
  v_on_error jsonb;
  v_action jsonb;
  v_action_type text;
  v_idx int := 0;
  v_inserted int := 0;
  v_child_depth int;
  v_key text;
  v_inner_on_error jsonb;
  v_row_count int;
begin
  select id, organization_id, rule_id, payload, depth, on_error_actions, action_type
    into v_parent
    from public.workflow_action_queue
   where id = p_parent_id
   for update;
  if not found then
    return 0;
  end if;

  v_on_error := coalesce(p_on_error, v_parent.on_error_actions);
  if v_on_error is null or jsonb_typeof(v_on_error) <> 'array'
     or jsonb_array_length(v_on_error) = 0 then
    return 0;
  end if;

  v_child_depth := least(coalesce(v_parent.depth, 0) + 1, 5);

  for v_action in select * from jsonb_array_elements(v_on_error)
  loop
    v_action_type := coalesce(v_action->>'type', 'log_only');

    v_inner_on_error := case
      when jsonb_typeof(v_action->'onError') = 'array' then v_action->'onError'
      when jsonb_typeof(v_action->'on_error') = 'array' then v_action->'on_error'
      else null
    end;

    v_key := encode(
      public.digest(
        v_parent.id::text || '|' || v_idx::text || '|' || v_action_type || '|on_error',
        'sha256'
      ),
      'hex'
    );

    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, status, execute_after,
      idempotency_key, on_error_actions, depth, parent_queue_id
    ) values (
      v_parent.organization_id,
      v_parent.rule_id,
      v_action_type,
      v_action
        || coalesce(v_parent.payload, '{}'::jsonb)
        || jsonb_build_object(
             'triggered_by',     'on_error',
             'parent_action_id', v_parent.id,
             'parent_action_type', v_parent.action_type
           ),
      'pending',
      now(),
      v_key,
      v_inner_on_error,
      v_child_depth,
      v_parent.id
    )
    on conflict (idempotency_key) where idempotency_key is not null do nothing;

    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + v_row_count;
    v_idx := v_idx + 1;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.workflow_enqueue_on_error_actions(uuid, jsonb)
  to service_role;

comment on function public.workflow_enqueue_on_error_actions(uuid, jsonb) is
  'Worker-side RPC. After a queue row terminally fails, reads its on_error_actions sibling list (or the caller-supplied override) and enqueues each as a new pending row with idempotency_key=sha256(parent_id|index|type|on_error). Depth = parent.depth + 1 so the cap holds end-to-end. Inherits organization_id / rule_id / parent payload context.';

-- ── 4. Extend workflow_queue_lease so leased rows carry depth +
--      on_error_actions. The worker uses both: depth gates execution at
--      the cap (handed off to workflow_record_depth_exceeded), and
--      on_error_actions is the source list for the enqueue RPC above. ───────

drop function if exists public.workflow_queue_lease(int);

create or replace function public.workflow_queue_lease(
  p_batch_size int default 25
)
returns table (
  id uuid,
  organization_id uuid,
  rule_id uuid,
  action_type text,
  step_type text,
  payload jsonb,
  config_json jsonb,
  context_json jsonb,
  attempt_count int,
  depth int,
  on_error_actions jsonb,
  parent_queue_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.workflow_action_queue q
     set status = 'processing',
         updated_at = now()
   where q.id in (
     select q2.id
       from public.workflow_action_queue q2
      where q2.status = 'pending'
        and q2.execute_after <= now()
      order by q2.execute_after
      limit p_batch_size
      for update skip locked
   )
  returning q.id, q.organization_id, q.rule_id, q.action_type, q.step_type,
            q.payload, q.config_json, q.context_json, q.attempt_count,
            q.depth, q.on_error_actions, q.parent_queue_id;
end;
$$;

grant execute on function public.workflow_queue_lease(int) to service_role;

comment on function public.workflow_queue_lease(int) is
  'Atomic batch-leaser for workflow_action_queue. Returns depth + on_error_actions + parent_queue_id alongside the action body so the worker can enforce the depth cap and the on_error chain transactionally. FOR UPDATE SKIP LOCKED keeps concurrent invocations safe.';
