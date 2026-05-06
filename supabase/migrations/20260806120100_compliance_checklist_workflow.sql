-- Compliance Checklist primitive — workflow integration.
--
-- Mirrors process_inspection_finding_workflow / execute_inspection_finding_rule_actions
-- (see archive/20260617120000_inspection_workflow_rules.sql) but operates on
-- compliance_checklist_responses where severity is non-null (is_finding=true).
--
-- Seeds one default rule per existing org:
--   compliance_checklist_critical — critical response → create_deviation.

-- ── 1. Per-rule action executor for compliance checklist responses ─────────

create or replace function public.execute_compliance_checklist_rule_actions(
  p_org_id                uuid,
  p_rule_id               uuid,
  p_actions               jsonb,
  p_response_id           uuid,
  p_response_comment      text,
  p_response_severity     text,
  p_response_created_by   uuid,
  p_execution_id          uuid,
  p_execution_title       text,
  p_execution_assigned_to uuid,
  p_item_key              text
)
returns uuid   -- first deviation_id created by this rule, or null
language plpgsql
security definer
set search_path = public
as $$
declare
  a          jsonb;
  v_dev_id   uuid := null;
  v_due_days int;
  v_title    text;
begin
  if jsonb_typeof(p_actions) <> 'array' then
    return null;
  end if;

  for a in select * from jsonb_array_elements(p_actions)
  loop
    case coalesce(a->>'type', '')

    when 'create_deviation' then
      if v_dev_id is null then
        v_due_days := coalesce((a->>'dueInDays')::int, 1);
        v_title := coalesce(
          nullif(trim(a->>'titlePrefix'), ''),
          p_execution_title
        ) || ' — ' || coalesce(p_item_key, 'sjekklistepunkt');

        insert into public.deviations (
          organization_id,
          source,
          source_id,
          title,
          description,
          severity,
          status,
          due_at,
          created_by
        ) values (
          p_org_id,
          'compliance_checklist_response',
          p_response_id,
          v_title,
          coalesce(p_response_comment, ''),
          p_response_severity::public.inspection_finding_severity,
          'open',
          now() + (v_due_days || ' days')::interval,
          p_response_created_by
        )
        returning id into v_dev_id;
      end if;

    else
      -- Other action types (create_task, send_email, etc.) deferred — Scope C
      -- only requires create_deviation. Future expansion can delegate to
      -- workflow_execute_actions() the way inspection does.
      null;
    end case;
  end loop;

  return v_dev_id;
end;
$$;

-- ── 2. AFTER INSERT trigger: evaluate workflow rules for this org ──────────

create or replace function public.process_compliance_checklist_response_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exec        record;
  v_rule        record;
  v_payload     jsonb;
  v_matched     boolean;
  v_dev_id      uuid := null;
  v_rule_dev_id uuid;
begin
  -- Only fire on findings (severity present).
  if new.severity is null then
    return new;
  end if;

  -- Idempotency: if this response is already linked to a deviation, skip.
  if new.deviation_id is not null then
    return new;
  end if;

  select e.* into v_exec
  from public.compliance_checklist_executions e
  where e.id = new.execution_id;

  v_payload := jsonb_build_object(
    'id',              new.id,
    'severity',        new.severity::text,
    'comment',         new.comment,
    'execution_id',    new.execution_id,
    'item_key',        new.item_key,
    'organization_id', new.organization_id,
    'created_by',      new.created_by,
    'pack',            v_exec.pack::text
  );

  for v_rule in
    select *
    from public.workflow_rules
    where organization_id = new.organization_id
      and source_module    = 'compliance_checklist'
      and is_active        = true
      and trigger_on       in ('insert', 'both')
    order by priority asc, created_at asc
  loop
    begin
      v_matched := public.workflow_payload_matches_condition(
        v_rule.condition_json, v_payload, null, 'insert'
      );

      if not v_matched then
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
          'skipped',
          jsonb_build_object('reason', 'condition_not_met', 'response_id', new.id)
        );
        continue;
      end if;

      v_rule_dev_id := public.execute_compliance_checklist_rule_actions(
        new.organization_id,
        v_rule.id,
        v_rule.actions_json,
        new.id,
        new.comment,
        new.severity::text,
        new.created_by,
        new.execution_id,
        coalesce(v_exec.title, 'Sjekkliste'),
        v_exec.assigned_to,
        new.item_key
      );

      if v_rule_dev_id is not null and v_dev_id is null then
        v_dev_id := v_rule_dev_id;
      end if;

      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
        'completed',
        jsonb_build_object(
          'response_id',  new.id,
          'execution_id', new.execution_id,
          'severity',     new.severity,
          'deviation_id', v_rule_dev_id
        )
      );

    exception when others then
      insert into public.workflow_runs (
        organization_id, rule_id, source_module, event, status, detail
      ) values (
        new.organization_id, v_rule.id, 'compliance_checklist', 'payload_change',
        'failed',
        jsonb_build_object('response_id', new.id, 'error', sqlerrm)
      );
    end;
  end loop;

  -- Stamp the response with the first deviation id (if any rule created one).
  if v_dev_id is not null then
    update public.compliance_checklist_responses
    set deviation_id = v_dev_id,
        updated_at   = now()
    where id = new.id;
  end if;

  return new;

exception when others then
  insert into public.workflow_runs (
    organization_id, rule_id, source_module, event, status, detail
  ) values (
    new.organization_id, null, 'compliance_checklist', 'payload_change',
    'failed',
    jsonb_build_object('response_id', new.id, 'error', sqlerrm)
  );
  return new;
end;
$$;

drop trigger if exists compliance_checklist_responses_workflow_tg on public.compliance_checklist_responses;
create trigger compliance_checklist_responses_workflow_tg
  after insert on public.compliance_checklist_responses
  for each row execute function public.process_compliance_checklist_response_workflow();

-- ── 3. Default rule: critical response → deviation (per org, idempotent) ───

insert into public.workflow_rules (
  organization_id,
  slug,
  name,
  description,
  source_module,
  trigger_on,
  is_active,
  condition_json,
  actions_json,
  priority,
  is_template
)
select
  o.id,
  'compliance_checklist_critical',
  'Kritisk sjekklistesvar → avvik',
  'Standard-regel: kritiske svar på en sjekklisteutførelse oppretter automatisk et avvik.',
  'compliance_checklist',
  'insert',
  true,
  '{"match":"field_equals","path":"severity","value":"critical"}'::jsonb,
  '[{"type":"create_deviation","dueInDays":1}]'::jsonb,
  100,
  false
from public.organizations o
on conflict (organization_id, slug) do nothing;
