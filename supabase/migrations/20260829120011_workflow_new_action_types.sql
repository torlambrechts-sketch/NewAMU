-- Workflow engine: new action type handler stubs
-- Extends execute_workflow_rule_actions() inside workflow_fire_rule() with
-- five new action types required by the V2 editor:
--   create_task_item    — inserts into task_items
--   create_ros_draft    — inserts into ros_assessments
--   add_amu_agenda_item — inserts into amu_agenda_items
--   request_signature   — inserts into signature_requests
--   wait_delay          — sets execute_after on the queue row
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: AML § 3-1 (2) e — iverksette tiltak automatisk
--   ved kritiske hendelser (task, ROS, AMU). IK § 5 nr. 7 — overvåking via
--   automatisk saksliste (AMU) og signaturkrav (signreq).
--   Restrisiko deferred: real MS Teams/SMS delivery (still log_only stubs).

-- The master workflow execution function is recreated here with the new
-- ELSIF branches appended. All existing branches (create_task, send_email,
-- send_notification, call_webhook, log_only) are preserved verbatim.

create or replace function public.execute_workflow_action(
  p_action jsonb,
  p_context jsonb   -- merged trigger payload + org context
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action_type text := p_action->>'type';
  v_org_id      uuid := (p_context->>'organization_id')::uuid;
  v_due_date    date;
begin
  -- ── create_task (legacy) ────────────────────────────────────────────────────
  if v_action_type = 'create_task' then
    insert into public.task_items (
      organization_id, pack, source_category, pdca_phase,
      title, description, status, priority,
      assignee_name, due_date, source_type, source_id,
      law_refs, requires_sign_off
    ) values (
      v_org_id,
      coalesce(p_action->>'pack', 'hms'),
      coalesce(p_action->>'sourceCategory', 'avvik'),
      coalesce(p_action->>'pdcaPhase', 'do'),
      coalesce(p_action->>'title', 'Automatisk oppgave'),
      coalesce(p_action->>'description', ''),
      'open',
      coalesce(p_action->>'priority', 'medium'),
      p_action->>'assigneeName',
      case when (p_action->>'dueDays') is not null
           then current_date + (p_action->>'dueDays')::int end,
      p_context->>'source_type',
      p_context->>'source_id',
      coalesce(
        (select array_agg(v) from jsonb_array_elements_text(p_action->'lawRefs') t(v)),
        '{}'::text[]
      ),
      false
    );

  -- ── create_task_item (new — pack-aware) ─────────────────────────────────────
  elsif v_action_type = 'create_task_item' then
    insert into public.task_items (
      organization_id, pack, source_category, pdca_phase,
      title, description, status, priority,
      due_date, source_type, source_id, requires_sign_off, law_refs
    ) values (
      v_org_id,
      coalesce(p_action->>'pack', 'hms'),
      coalesce(p_action->>'sourceCategory', 'avvik'),
      coalesce(p_action->>'pdcaPhase', 'do'),
      coalesce(p_action->>'title', 'Automatisk oppgave'),
      '',
      'open',
      coalesce(p_action->>'priority', 'medium'),
      case when (p_action->>'dueInDays') is not null
           then current_date + (p_action->>'dueInDays')::int end,
      p_context->>'source_type',
      p_context->>'source_id',
      false,
      '{}'::text[]
    );

  -- ── create_ros_draft ─────────────────────────────────────────────────────────
  elsif v_action_type = 'create_ros_draft' then
    insert into public.ros_assessments (
      organization_id, title, template, status, source_type, source_id
    )
    select
      v_org_id,
      'ROS-utkast — ' || coalesce(p_context->>'title', 'automatisk'),
      coalesce(p_action->>'template', 'standard 5×5'),
      'draft',
      case when (p_action->>'linkSource')::boolean then p_context->>'source_type' end,
      case when (p_action->>'linkSource')::boolean then p_context->>'source_id' end
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'ros_assessments'
    );

  -- ── add_amu_agenda_item ───────────────────────────────────────────────────────
  elsif v_action_type = 'add_amu_agenda_item' then
    insert into public.amu_agenda_items (
      organization_id, title, priority, source_type, source_id, status
    )
    select
      v_org_id,
      coalesce(p_action->>'agendaItem', 'Automatisk sak'),
      coalesce(p_action->>'priority', 'normal'),
      p_context->>'source_type',
      p_context->>'source_id',
      'pending'
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'amu_agenda_items'
    );

  -- ── request_signature ─────────────────────────────────────────────────────────
  elsif v_action_type = 'request_signature' then
    insert into public.signature_requests (
      organization_id, document_ref, deadline_date, status, source_type, source_id
    )
    select
      v_org_id,
      coalesce(p_action->>'document', ''),
      case when (p_action->>'deadlineDays') is not null
           then current_date + (p_action->>'deadlineDays')::int end,
      'pending',
      p_context->>'source_type',
      p_context->>'source_id'
    where exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'signature_requests'
    );

  -- ── wait_delay ────────────────────────────────────────────────────────────────
  -- The queue row's execute_after is updated by workflow_fire_rule() when it
  -- encounters a wait_delay step. This handler is a no-op (delay logic lives
  -- in the queue processor), but we register it to keep the action union valid.
  elsif v_action_type = 'wait_delay' then
    -- handled by queue scheduler; no direct insert here
    null;

  -- ── send_email (existing stub) ────────────────────────────────────────────────
  elsif v_action_type = 'send_email' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'send_email',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  -- ── send_notification (existing stub) ────────────────────────────────────────
  elsif v_action_type = 'send_notification' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'send_notification',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  -- ── call_webhook (existing stub) ──────────────────────────────────────────────
  elsif v_action_type = 'call_webhook' then
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'call_webhook',
      p_action || p_context,
      now()
    )
    on conflict do nothing;

  -- ── log_only (fallback / test) ────────────────────────────────────────────────
  else
    insert into public.workflow_action_queue (
      organization_id, rule_id, action_type, payload, execute_after
    ) values (
      v_org_id,
      (p_context->>'rule_id')::uuid,
      'log_only',
      jsonb_build_object('action', p_action, 'context', p_context),
      now()
    )
    on conflict do nothing;
  end if;
end;
$$;
