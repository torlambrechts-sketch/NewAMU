-- Extend workflow engine: per-table DB-event triggers, multi-step rules,
-- and a delivery queue for async actions (email, webhook, SMS).

-- ─── 1. Extend workflow_rules ────────────────────────────────────────────────

alter table public.workflow_rules
  add column if not exists trigger_type text not null default 'payload_change'
    check (trigger_type in ('payload_change','db_event','schedule','manual','webhook_in')),
  add column if not exists trigger_event_name text,   -- e.g. 'round_signed', 'finding_critical'
  add column if not exists schedule_cron text;        -- for trigger_type = 'schedule'

-- ─── 2. workflow_steps ───────────────────────────────────────────────────────

create table if not exists public.workflow_steps (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id        uuid not null references public.workflow_rules (id) on delete cascade,
  step_order     int  not null default 0,
  step_type      text not null check (step_type in (
                   'create_task','create_deviation','send_notification',
                   'send_email','call_webhook','call_api',
                   'send_sms','slack_message','teams_message',
                   'update_record','run_workflow','wait')),
  config_json    jsonb not null default '{}',
  delay_minutes  int  not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists workflow_steps_rule_idx
  on public.workflow_steps (rule_id, step_order);

drop trigger if exists workflow_steps_set_updated_at on public.workflow_steps;
create trigger workflow_steps_set_updated_at
  before update on public.workflow_steps
  for each row execute function public.set_updated_at();

alter table public.workflow_steps enable row level security;

drop policy if exists "workflow_steps_select_org" on public.workflow_steps;
create policy "workflow_steps_select_org"
  on public.workflow_steps for select
  using (organization_id = public.current_org_id());

drop policy if exists "workflow_steps_write_manage" on public.workflow_steps;
create policy "workflow_steps_write_manage"
  on public.workflow_steps for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('workflows.manage'))
  );

-- ─── 3. workflow_action_queue  (async delivery for email/webhook/sms) ────────

create table if not exists public.workflow_action_queue (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_id         uuid references public.workflow_rules (id) on delete set null,
  step_id         uuid references public.workflow_steps (id) on delete set null,
  step_type       text not null,
  config_json     jsonb not null default '{}',
  context_json    jsonb not null default '{}',
  status          text not null default 'pending'
                    check (status in ('pending','processing','done','failed')),
  attempt_count   int not null default 0,
  last_error      text,
  execute_after   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists workflow_action_queue_pending_idx
  on public.workflow_action_queue (status, execute_after)
  where status = 'pending';

drop trigger if exists workflow_action_queue_set_updated_at on public.workflow_action_queue;
create trigger workflow_action_queue_set_updated_at
  before update on public.workflow_action_queue
  for each row execute function public.set_updated_at();

alter table public.workflow_action_queue enable row level security;

drop policy if exists "workflow_action_queue_select_org" on public.workflow_action_queue;
create policy "workflow_action_queue_select_org"
  on public.workflow_action_queue for select
  using (organization_id = public.current_org_id());

-- ─── 4. Execution helpers ────────────────────────────────────────────────────

-- Evaluate a simple condition against a JSONB row.
create or replace function public.workflow_row_matches_condition(
  p_condition jsonb,
  p_row       jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  m   text;
  sub jsonb;
  all_match boolean;
begin
  if p_condition is null then return true; end if;
  m := coalesce(p_condition->>'match', 'always');

  if m = 'always' then return true; end if;

  if m = 'field_eq' then
    return (p_row ->> (p_condition->>'field')) = (p_condition->>'value');
  end if;

  if m = 'field_neq' then
    return (p_row ->> (p_condition->>'field')) <> (p_condition->>'value');
  end if;

  if m = 'and' then
    all_match := true;
    for sub in select * from jsonb_array_elements(p_condition->'conditions')
    loop
      if not public.workflow_row_matches_condition(sub, p_row) then
        all_match := false;
        exit;
      end if;
    end loop;
    return all_match;
  end if;

  if m = 'or' then
    for sub in select * from jsonb_array_elements(p_condition->'conditions')
    loop
      if public.workflow_row_matches_condition(sub, p_row) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  return true;
end;
$$;

-- Execute a single immediate step.
create or replace function public.workflow_execute_step(
  p_org_id     uuid,
  p_rule_id    uuid,
  p_step_id    uuid,
  p_step_type  text,
  p_config     jsonb,
  p_context    jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text;
  v_due     text;
  v_task    jsonb;
  v_sev     text;
begin
  if p_step_type = 'create_task' then
    v_title := coalesce(p_config->>'title', 'Arbeidsflyt-oppgave');
    v_due   := (current_date + (coalesce((p_config->>'dueInDays')::int, 7) || ' days')::interval)::date::text;
    v_task  := jsonb_build_object(
      'id',          gen_random_uuid()::text,
      'title',       v_title,
      'description', coalesce(p_config->>'description', ''),
      'status',      'todo',
      'assignee',    coalesce(p_config->>'assignee', ''),
      'ownerRole',   coalesce(p_config->>'ownerRole', 'HMS'),
      'dueDate',     v_due,
      'createdAt',   to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'module',      coalesce(p_context->>'module', 'inspection'),
      'sourceType',  coalesce(p_context->>'eventName', 'workflow'),
      'sourceId',    coalesce(p_context->>'rowId', ''),
      'sourceLabel', coalesce(p_config->>'sourceLabel', v_title),
      'requiresManagementSignOff', false
    );
    perform public.workflow_append_task(p_org_id, v_task);

  elsif p_step_type = 'create_deviation' then
    v_sev := coalesce(p_config->>'severity', 'medium');
    insert into public.deviations
      (organization_id, source, source_id, title, description, severity, status)
    values (
      p_org_id,
      'workflow',
      (p_context->>'rowId')::uuid,
      coalesce(p_config->>'title', 'Avvik fra arbeidsflyt'),
      coalesce(p_config->>'description', ''),
      v_sev::public.inspection_finding_severity,
      'open'
    );

  else
    -- send_notification, send_email, call_webhook, call_api, send_sms, etc.
    -- Queue for Edge Function delivery.
    insert into public.workflow_action_queue
      (organization_id, rule_id, step_id, step_type, config_json, context_json,
       execute_after, status)
    values (
      p_org_id, p_rule_id, p_step_id, p_step_type, p_config, p_context,
      now(), 'pending'
    );
  end if;
end;
$$;

-- Process all steps for a matching rule.
create or replace function public.workflow_fire_rule(
  p_rule_id   uuid,
  p_org_id    uuid,
  p_event     text,
  p_context   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step  record;
begin
  insert into public.workflow_runs
    (organization_id, rule_id, source_module, event, status, detail)
  values (
    p_org_id, p_rule_id,
    coalesce(p_context->>'module', 'inspection'),
    'db_event',
    'completed',
    jsonb_build_object('event', p_event, 'context', p_context)
  );

  for v_step in
    select * from public.workflow_steps
    where rule_id = p_rule_id
    order by step_order
  loop
    if v_step.delay_minutes = 0 then
      perform public.workflow_execute_step(
        p_org_id, p_rule_id, v_step.id,
        v_step.step_type, v_step.config_json, p_context
      );
    else
      insert into public.workflow_action_queue
        (organization_id, rule_id, step_id, step_type,
         config_json, context_json, execute_after, status)
      values (
        p_org_id, p_rule_id, v_step.id, v_step.step_type,
        v_step.config_json, p_context,
        now() + (v_step.delay_minutes || ' minutes')::interval,
        'pending'
      );
    end if;
  end loop;
end;
$$;

-- ─── 5. DB-event dispatcher (called by table triggers) ───────────────────────

create or replace function public.workflow_dispatch_db_event(
  p_org_id    uuid,
  p_module    text,
  p_event     text,
  p_row       jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule   record;
  v_ctx    jsonb;
begin
  v_ctx := jsonb_build_object(
    'module',    p_module,
    'eventName', p_event,
    'rowId',     p_row->>'id',
    'row',       p_row
  );

  for v_rule in
    select id
    from public.workflow_rules
    where organization_id = p_org_id
      and trigger_type      = 'db_event'
      and trigger_event_name = p_event
      and is_active          = true
      and public.workflow_row_matches_condition(condition_json, p_row)
  loop
    perform public.workflow_fire_rule(v_rule.id, p_org_id, p_event, v_ctx);
  end loop;
end;
$$;

-- ─── 6. Triggers on inspection_rounds ────────────────────────────────────────

create or replace function public.trg_inspection_rounds_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_row   jsonb;
begin
  v_row := to_jsonb(NEW);

  if TG_OP = 'INSERT' then
    v_event := 'round_created';
  elsif TG_OP = 'UPDATE' then
    if NEW.status = 'signed'  and OLD.status <> 'signed'  then v_event := 'round_signed';
    elsif NEW.status = 'active' and OLD.status <> 'active' then v_event := 'round_activated';
    else return NEW;
    end if;
  end if;

  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'inspection', v_event, v_row
  );
  return NEW;
end;
$$;

drop trigger if exists inspection_rounds_workflow_tg on public.inspection_rounds;
create trigger inspection_rounds_workflow_tg
  after insert or update of status
  on public.inspection_rounds
  for each row execute function public.trg_inspection_rounds_workflow();

-- ─── 7. Triggers on inspection_findings ─────────────────────────────────────

create or replace function public.trg_inspection_findings_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text;
  v_row   jsonb;
begin
  v_row := to_jsonb(NEW);

  -- 'finding_critical', 'finding_high', 'finding_medium', 'finding_low'
  v_event := 'finding_' || NEW.severity::text;

  perform public.workflow_dispatch_db_event(
    NEW.organization_id, 'inspection', v_event, v_row
  );
  return NEW;
end;
$$;

drop trigger if exists inspection_findings_workflow_tg on public.inspection_findings;
create trigger inspection_findings_workflow_tg
  after insert
  on public.inspection_findings
  for each row execute function public.trg_inspection_findings_workflow();
